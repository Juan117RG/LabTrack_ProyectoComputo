import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import request from 'supertest';
import app from '../src/app.ts';
import pool from '../src/db.ts';

const originalQueryDescriptor = Object.getOwnPropertyDescriptor(pool, 'query');

afterEach(() => {
  if (originalQueryDescriptor) {
    Object.defineProperty(pool, 'query', originalQueryDescriptor);
  }
});

function mockDatabase(rows: unknown[]) {
  const queries: unknown[][] = [];

  Object.defineProperty(pool, 'query', {
    configurable: true,
    value: async (...args: unknown[]) => {
      queries.push(args);
      return { rows };
    },
  });

  return queries;
}

test('GET /api/equipment returns all equipment without a filter', async () => {
  const equipment = [
    {
      id: 1,
      name: 'Microscopio',
      description: 'Equipo óptico',
      status: 'available',
    },
  ];
  const queries = mockDatabase(equipment);

  const response = await request(app).get('/api/equipment');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, equipment);
  assert.match(String(queries[0]?.[0]), /FROM equipment/);
  assert.doesNotMatch(String(queries[0]?.[0]), /WHERE status/);
});

test('GET /api/equipment filters by status', async () => {
  const equipment = [
    {
      id: 2,
      name: 'Multímetro',
      description: 'Instrumento de medición',
      status: 'maintenance',
    },
  ];
  const queries = mockDatabase(equipment);

  const response = await request(app)
    .get('/api/equipment')
    .query({ status: 'maintenance' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, equipment);
  assert.match(String(queries[0]?.[0]), /WHERE status = \$1/);
  assert.deepEqual(queries[0]?.[1], ['maintenance']);
});

test('GET /api/equipment rejects an unsupported status', async () => {
  const response = await request(app)
    .get('/api/equipment')
    .query({ status: 'broken' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/equipment creates equipment with the validated data', async () => {
  const equipment = {
    id: 3,
    name: 'Osciloscopio',
    description: 'Equipo de laboratorio',
    status: 'available',
  };
  const queries = mockDatabase([equipment]);

  const response = await request(app)
    .post('/api/equipment')
    .send({
      name: equipment.name,
      description: equipment.description,
    });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, equipment);
  assert.deepEqual(queries[0]?.[1], [
    equipment.name,
    equipment.description,
    'available',
  ]);
});
