import {
  BaseEntity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Entity,
} from 'typeorm';
import { Setor } from 'src/setor/setor.entity';

@Entity()
export class Problema extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ type: 'text' })
  descricao: string;

  @ManyToOne(
    () => Setor,
    setor => setor.problemas,
    { eager: false },
  )
  setor: Setor;
}