import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { Chamado } from '../chamado.entity';
import { User } from '../../auth/user.entity';
import { AlteracaoStatus, AlteracaoStatusChanger } from './alteracao.status';
import { AlteracaoPriority } from './alteracao-priority.enum';

@Entity()
export class Alteracao extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  data: Date;
  @Column({ type: 'text', nullable: true })
  descricao: string;
  @Column({ default: AlteracaoStatus.ABERTO })
  situacao: AlteracaoStatus;
  @Column({ default: AlteracaoPriority.MEDIA })
  prioridade: AlteracaoPriority;
  @Column()
  chamadoId: number;
  @Column({ nullable: true })
  userId: number;

  @ManyToOne(
    () => Chamado,
    chamado => chamado.alteracoes,
  )
  chamado: Chamado;
  @ManyToOne(
    () => User,
    user => user.alteracoes,
  )
  user: User;

  private situacaoColor = {
    [AlteracaoStatus.ABERTO]: 'white',
    [AlteracaoStatus.CANCELADO]: 'red',
    [AlteracaoStatus.CONCLUIDO]: 'green',
    [AlteracaoStatus.EM_ATENDIMENTO]: 'blue',
    [AlteracaoStatus.PENDENTE]: 'yellow',
    [AlteracaoStatus.TRANSFERIDO]: 'orange',
  };
  situacaoStatusChanger = new AlteracaoStatusChanger();

  get color() {
    return this.situacaoColor[this.situacao];
  }
}
