import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ProductWithCategory } from './ProductWithCategory.entity';
import { Category } from './Category.entity';

/**
 * Order entity WITHOUT any i18n columns.
 * Used to test that joined entities with i18n columns are still translated
 * even when the root entity has no i18n metadata.
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  orderNumber!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'real' })
  totalPrice!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true })
  productId!: number | null;

  @ManyToOne(() => ProductWithCategory, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: ProductWithCategory;

  @Column({ nullable: true })
  categoryId!: number | null;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;
}
