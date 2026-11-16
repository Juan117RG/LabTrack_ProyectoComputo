import type { Request, Response } from 'express';
import equipmentService from '../services/equipment.service.js';
import type { CreateEquipmentData, EquipmentFilter } from '../types/equipment.types.js';
import { errorResponse, successResponse } from '../utils/response.js';

const equipmentController = {
  getEquipment: async (_req: Request, res: Response) => {
    try {
      const { status } = res.locals.validatedData as EquipmentFilter;
      const equipment = await equipmentService.getEquipment({ status });
      return successResponse(res, 'Equipment obtained successfully', equipment);
    } catch (error: unknown) {
      console.error('Error obtaining equipment:', error);
      return errorResponse(
        res,
        'Error obtaining equipment',
        'EQUIPMENT_FETCH_ERROR',
        500,
        [],
      );
    }
  },
  createEquipment: async (_req: Request, res: Response) => {
    try {
      const data = res.locals.validatedData as CreateEquipmentData;
      const equipment = await equipmentService.createEquipment(data);
      return successResponse(res, 'Equipment created successfully', equipment);
    } catch (error: unknown) {
      console.error('Error creating equipment:', error);
      return errorResponse(
        res,
        'Error creating equipment',
        'EQUIPMENT_CREATE_ERROR',
        500,
        [],
      );
    }
  },
};

export default equipmentController;