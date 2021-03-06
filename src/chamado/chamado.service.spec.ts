import { Test, TestingModule } from '@nestjs/testing';
import { mocked } from 'ts-jest/utils';
import { paginate } from 'nestjs-typeorm-paginate';

import { ChamadoService } from './chamado.service';
import { ChamadoRepository } from './chamado.repository';
import { ChamadoTIRepository } from './chamado-ti.repository';
import { SolicitanteService } from '../solicitante/solicitante.service';
import { SetorService } from '../setor/setor.service';
import { QueryRunnerFactory } from '../util/query-runner.factory';
import {
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { AlteracaoService } from './alteracao/alteracao.service';
import { BullModule } from '@nestjs/bull';
import { chamadoQueueConfig } from './chamado.queue.config';

jest.mock('nestjs-typeorm-paginate');
const mockPaginate = mocked(paginate, true);

jest.mock('bull');

const mockChamadoRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  createChamado: jest.fn(),
  cancelChamadoSituacao: jest.fn(),
});
const mockChamadoTIRepository = () => ({
  createChamadoTI: jest.fn(),
});
const mockSolicitanteService = () => ({
  findSolicitanteOrCreate: jest.fn(),
});
const mockSetorService = () => ({
  getSetorByID: jest.fn(),
});
const mockQueryRunnerFactory = () => ({
  createRunnerAndBeginTransaction: jest.fn(),
});
const mockAlteracaoService = () => ({ createAlteracao: jest.fn() });

const mockSolicitante = { id: 1 };

describe('ChamadoService', () => {
  const value = 42;
  let chamadoService;
  let chamadoRepository;
  let chamadoTIRepository;
  let solicitanteService;
  let setorService;
  let queryRunnerFactory;
  let alteracaoService;
  let bullModule;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BullModule.registerQueue(chamadoQueueConfig)],
      providers: [
        ChamadoService,
        { provide: ChamadoRepository, useFactory: mockChamadoRepository },
        { provide: ChamadoTIRepository, useFactory: mockChamadoTIRepository },
        { provide: SolicitanteService, useFactory: mockSolicitanteService },
        { provide: SetorService, useFactory: mockSetorService },
        { provide: AlteracaoService, useFactory: mockAlteracaoService },
        { provide: QueryRunnerFactory, useFactory: mockQueryRunnerFactory },
      ],
    }).compile();

    chamadoService = module.get<ChamadoService>(ChamadoService);
    chamadoRepository = module.get<ChamadoRepository>(ChamadoRepository);
    chamadoTIRepository = module.get<ChamadoTIRepository>(ChamadoTIRepository);
    solicitanteService = module.get<SolicitanteService>(SolicitanteService);
    setorService = module.get<SetorService>(SetorService);
    queryRunnerFactory = module.get<QueryRunnerFactory>(QueryRunnerFactory);
    alteracaoService = module.get<AlteracaoService>(AlteracaoService);
    bullModule = module.get<BullModule>(BullModule);
  });

  it('should be defined', () => {
    expect(chamadoService).toBeDefined();
    expect(chamadoRepository).toBeDefined();
    expect(chamadoTIRepository).toBeDefined();
    expect(solicitanteService).toBeDefined();
    expect(setorService).toBeDefined();
    expect(queryRunnerFactory).toBeDefined();
    expect(bullModule).toBeDefined();
  });

  it('getChamados', async () => {
    await chamadoService.getChamados(mockSolicitante);
    expect(mockPaginate).toBeCalled();
  });

  describe('getChamadoById', () => {
    const mockSearch = {
      where: { id: 1, solicitanteId: mockSolicitante.id },
    };
    it('return chamado', async () => {
      chamadoRepository.findOne.mockResolvedValue(value);
      const result = await chamadoService.getChamadoById(
        mockSearch.where.id,
        mockSolicitante,
      );
      expect(chamadoRepository.findOne).toBeCalledWith(mockSearch);
      expect(result).toEqual(value);
    });

    it('throw 404 as chamado not found', () => {
      chamadoRepository.findOne.mockResolvedValue(null);
      expect(chamadoRepository.findOne).not.toBeCalled();
      expect(
        chamadoService.getChamadoById(mockSearch.where.id, mockSolicitante),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteChamado', () => {
    const id = 1;
    it('delete succesfully', async () => {
      chamadoRepository.delete.mockResolvedValue({ affected: 1 });
      await chamadoService.deleteChamado(id, mockSolicitante);
      expect(chamadoRepository.delete).toBeCalled();
    });

    it('throw 404 as none of row was affected', () => {
      chamadoRepository.delete.mockResolvedValue({ affected: 0 });
      expect(chamadoService.deleteChamado(id, mockSolicitante)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('testsWithTransaction', () => {
    let transaction;
    let mockDto;
    let setor;
    let chamado;
    let solicitante;
    let alteracao;

    beforeEach(() => {
      setor = {};
      chamado = { alteracoes: [] };
      solicitante = {};
      alteracao = {};
      transaction = {
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };
      queryRunnerFactory.createRunnerAndBeginTransaction.mockResolvedValue(
        transaction,
      );
      transaction.release.mockResolvedValue(null);
      setorService.getSetorByID.mockResolvedValue(setor);
      solicitanteService.findSolicitanteOrCreate.mockResolvedValue(solicitante);
      chamadoRepository.createChamado.mockResolvedValue(chamado);
      alteracaoService.createAlteracao.mockResolvedValue(alteracao);
      mockDto = {
        description: 'testDescription',
        setorId: 1,
        solicitante: {},
      };
    });

    describe('transferChamado', () => {
      let mockUser;
      beforeEach(() => {
        transaction.manager = {
          findOne: jest.fn(),
          save: jest.fn(),
        };
        mockUser = { username: 'testUser' };
        // chamadoGateway.broadcastChamados.mockResolvedValue(null);
      });

      it('should be defined', () => {
        expect(transaction.manager).toBeDefined();
        expect(mockUser).toBeDefined();
      });

      it('succesfully transfer chamado', async () => {
        const mockDto = {
          transferido: { setorId: 1, userId: 1 },
        };
        transaction.manager.findOne.mockResolvedValue(chamado);
        const result = await chamadoService.transferChamado(
          1,
          mockDto,
          mockUser,
        );
        expect(queryRunnerFactory.createRunnerAndBeginTransaction).toBeCalled();
        expect(transaction.manager.findOne).toBeCalled();
        expect(setorService.getSetorByID).toBeCalled();
        expect(transaction.manager.save).toBeCalled();
        expect(alteracaoService.createAlteracao).toBeCalled();
        expect(transaction.commit).toBeCalled();
        // expect(chamadoGateway.broadcastChamados).toBeCalled();
        expect(result).toEqual(chamado);
      });

      it('throw 404 as chamado not found', () => {
        const mockChamado = {
          ti: true,
        };
        transaction.manager.findOne.mockResolvedValue(null);
        transaction.rollback.mockResolvedValue(null);
        expect(
          chamadoService.transferChamado(1, mockChamado, mockUser),
        ).rejects.toThrow(NotFoundException);
      });

      it('throw 403 as chamado ti should not be transfered', () => {
        const mockChamado = {
          ti: true,
        };
        transaction.manager.findOne.mockResolvedValue(mockChamado);
        transaction.rollback.mockResolvedValue(null);
        expect(
          chamadoService.transferChamado(1, mockChamado, mockUser),
        ).rejects.toThrow(ForbiddenException);
      });

      it('throw 500 as something weird occurs', () => {
        const mockDto = {
          transferido: { setorId: 1, userId: 1 },
        };
        transaction.manager.findOne.mockResolvedValue(chamado);
        transaction.manager.save.mockRejectedValue(new Error('databaseFails'));
        expect(
          chamadoService.transferChamado(1, mockDto, mockUser),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    it('should be deifned', () => {
      expect(transaction).toBeDefined();
      expect(mockDto).toBeDefined();
      expect(setor).toBeDefined();
      expect(chamado).toBeDefined();
      expect(solicitante).toBeDefined();
      expect(alteracao).toBeDefined();
    });

    describe('createChamado', () => {
      it('createChamadoDto should be defined', () => {
        expect(mockDto).toBeDefined();
        expect(setor).toBeDefined();
      });

      it('create chamado successfully', async () => {
        transaction.commit.mockResolvedValue(null);
        const result = await chamadoService.createChamado(mockDto);
        expect(queryRunnerFactory.createRunnerAndBeginTransaction).toBeCalled();
        expect(setorService.getSetorByID).toBeCalled();
        expect(solicitanteService.findSolicitanteOrCreate).toBeCalled();
        expect(chamadoRepository.createChamado).toBeCalled();
        // expect(chamadoGateway.broadcastChamados).toBeCalled();
        expect(result).toEqual(chamado);
      });

      it('create chamado ti successfully', async () => {
        const id = 1;
        setor.problemas = [{ id }];
        mockDto.ti = {};
        mockDto.problemaId = id;
        transaction.commit.mockResolvedValue(null);
        chamadoTIRepository.createChamadoTI.mockResolvedValue(mockDto.ti);
        const result = await chamadoService.createChamado(mockDto);
        expect(queryRunnerFactory.createRunnerAndBeginTransaction).toBeCalled();
        expect(setorService.getSetorByID).toBeCalled();
        expect(solicitanteService.findSolicitanteOrCreate).toBeCalled();
        expect(chamadoTIRepository.createChamadoTI).toBeCalled();
        expect(chamadoRepository.createChamado).toBeCalled();
        // expect(chamadoGateway.broadcastChamados).toBeCalled();
        expect(result).toEqual(chamado);
      });

      it('throw 404 as problema not found in setor', () => {
        setor.problemas = [];
        mockDto.problemaId = 1;
        transaction.rollback.mockResolvedValue(null);
        expect(chamadoService.createChamado(mockDto)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('throw 500 as transaction rollback', () => {
        transaction.rollback.mockResolvedValue(null);
        alteracaoService.createAlteracao.mockRejectedValue(
          new Error('databaseError'),
        );
        expect(chamadoService.createChamado(mockDto)).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });
  });

  describe('updateChamadoSituacao', () => {
    let mockChamado;
    let mockAlteracao;

    beforeEach(() => {
      mockChamado = { alteracoes: [] };
      mockAlteracao = { id: 1 };
    });

    it('should be defined', () => {
      expect(mockChamado).toBeDefined();
      expect(mockAlteracao).toBeDefined();
    });

    it('succesfully returns chamado', async () => {
      chamadoRepository.findOne.mockResolvedValue(mockChamado);
      alteracaoService.createAlteracao.mockResolvedValue(mockAlteracao);
      const result = await chamadoService.updateChamadoSituacao(1, {}, {});
      mockChamado.alteracoes.push(mockAlteracao);
      expect(chamadoRepository.findOne).toBeCalled();
      expect(alteracaoService.createAlteracao).toBeCalled();
      expect(result).toEqual(mockChamado);
    });

    it('cancelChamadosSituacao', async () => {
      chamadoRepository.findOne.mockResolvedValue(mockChamado);
      alteracaoService.createAlteracao.mockResolvedValue(mockAlteracao);
      const result = await chamadoService.cancelChamadoSituacao(
        1,
        mockSolicitante,
      );
      mockChamado.alteracoes.push(mockAlteracao);
      expect(chamadoRepository.findOne).toBeCalled();
      expect(alteracaoService.createAlteracao).toBeCalled();
      expect(result).toEqual(mockChamado);
    });

    it('throw 404 as chamado not found', () => {
      chamadoRepository.findOne.mockResolvedValue(null);
      expect(chamadoService.updateChamadoSituacao(1, {}, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelChamadoSituacao', () => {
    const id = value;
    let mockChamado;
    let mockSolicitante;

    beforeEach(() => {
      mockChamado = { id, alteracoes: [] };
      mockSolicitante = { cpf: 'testCpf' };
    });

    it('should be defined', () => {
      expect(mockChamado).toBeDefined();
      expect(mockSolicitante).toBeDefined();
    });

    it('succesfully cancel chamado', async () => {
      const mockAlteracao = { id };
      chamadoRepository.findOne.mockResolvedValue(mockChamado);
      alteracaoService.createAlteracao.mockResolvedValue(mockAlteracao);
      // chamadoGateway.broadcastChamados.mockResolvedValue(null);
      const result = await chamadoService.cancelChamadoSituacao(
        id,
        mockSolicitante,
      );
      mockChamado.alteracoes.push(mockAlteracao);
      // expect(chamadoGateway.broadcastChamados).toBeCalled();
      expect(result).toEqual(mockChamado);
    });

    it('throw 404 as chamado not found', () => {
      chamadoRepository.findOne.mockResolvedValue(null);
      expect(
        chamadoService.getChamadoById(id, mockSolicitante),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
