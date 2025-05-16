// Vrednosti ovih enuma MORAJU tačno odgovarati prisma/schema.prisma

export enum UserRole {
  USER = 'USER',
  VENDOR_OWNER = 'VENDOR_OWNER',
  WORKER = 'WORKER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum VendorStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED_BY_USER = 'CANCELLED_BY_USER',
  CANCELLED_BY_VENDOR = 'CANCELLED_BY_VENDOR',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

export enum SenderType {
  USER = 'USER',
  ADMIN = 'ADMIN',
  AI = 'AI',
}
