import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Member } from '../members/member.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @OneToOne(() => Member, (member) => member.user)
  member: Member | null;
}
