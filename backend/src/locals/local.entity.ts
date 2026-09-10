import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { Member } from '../members/member.entity';

@Entity('locals')
export class Local {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @OneToMany(() => Member, (member) => member.local)
  members: Member[];

  @OneToMany(() => Announcement, (announcement) => announcement.local)
  announcements: Announcement[];
}
