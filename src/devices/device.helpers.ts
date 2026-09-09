import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function deviceShape(d: any) {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    min: d.min,
    tags: d.tags,
    expires: d.expires ? d.expires.toISOString() : null,
  };
}

/**
 * Loads a device scoped to the requesting user's ownership chain.
 * Throws 404 when not found or not owned (no information leak).
 */
export async function loadOwnedDevice(
  prisma: PrismaService,
  deviceId: string,
  ownerIds: Set<string>,
) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || !ownerIds.has(device.ownerId)) {
    throw new NotFoundException('Device not found.');
  }
  return device;
}
