import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';
import { mockPrisma } from './test-utils';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: mockPrisma() }],
    }).compile();
    controller = module.get(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('names itself at the root, with where to check its health', () => {
    expect(controller.getRoot()).toMatchObject({ name: 'TeXeR API', status: 'ok', health: '/health' });
  });
});
