import { Order } from '../entities/Order.entity';

export const orderFixtures: Partial<Order>[] = [
  {
    id: 1,
    orderNumber: 'ORD-001',
    quantity: 2,
    totalPrice: 1999.98,
    productId: 1, // Laptop
    categoryId: 1, // Electronics
  },
  {
    id: 2,
    orderNumber: 'ORD-002',
    quantity: 3,
    totalPrice: 149.97,
    productId: 2, // Mouse
    categoryId: 2, // Accessories
  },
  {
    id: 3,
    orderNumber: 'ORD-003',
    quantity: 1,
    totalPrice: 149.99,
    productId: 3, // Keyboard
    categoryId: 2, // Accessories
  },
  {
    id: 4,
    orderNumber: 'ORD-004',
    quantity: 1,
    totalPrice: 399.99,
    productId: 4, // Monitor
    categoryId: null, // No category (direct category relation)
  },
];
