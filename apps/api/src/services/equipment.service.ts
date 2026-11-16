import equipmentRepository from '../repositories/equipment.repository.js';
import type {
  CreateEquipmentData,
  Equipment,
  EquipmentFilter,
} from '../types/equipment.types.js';

const equipmentService = {
  getEquipment: async (filter: EquipmentFilter): Promise<Equipment[]> => {
    return equipmentRepository.getEquipment(filter);
  },
  createEquipment: async (
    equipmentData: CreateEquipmentData,
  ): Promise<Equipment> => {
    return equipmentRepository.createEquipment(equipmentData);
  },
};

export default equipmentService;