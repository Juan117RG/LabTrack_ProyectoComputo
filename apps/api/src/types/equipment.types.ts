export type EquipmentStatus = 'available' | 'unavailable';

export type EquipmentFilter = {
  status?: EquipmentStatus;
};

export type CreateEquipmentData = {
  name: string;
  description?: string;
  status: EquipmentStatus;
};

export type Equipment = {
  id: number;
  name: string;
  description: string | null;
  status: EquipmentStatus;
};
