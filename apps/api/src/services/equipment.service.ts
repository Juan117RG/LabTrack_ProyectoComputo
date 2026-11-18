import equipmentRepository from "../repositories/equipment.repository.js";
import type {
  CreateEquipmentData,
  Equipment,
  EquipmentFilter,
} from "../types/equipment.types.js";

const equipmentService = {
  getEquipment: async (filter: EquipmentFilter): Promise<Equipment[]> => {
    return equipmentRepository.getEquipment(filter);
  },
  getEquipmentById: async (id: number): Promise<Equipment | null> => {
    const equipment = await equipmentRepository.getEquipmentById(id);
    return equipment || null;
  },
  createEquipment: async (
    equipmentData: CreateEquipmentData,
  ): Promise<Equipment> => {
    return equipmentRepository.createEquipment(equipmentData);
  },
  setEquipmentStatus: async (
    id: number,
    status: "available" | "unavailable",
  ): Promise<Equipment | null> => {
    const equipment = await equipmentRepository.getEquipmentById(id);
    if (!equipment) {
      return null;
    }
    const updatedEquipment = await equipmentRepository.updateEquipmentStatus(
      id,
      status,
    );
    return updatedEquipment;
  },
};

export default equipmentService;
