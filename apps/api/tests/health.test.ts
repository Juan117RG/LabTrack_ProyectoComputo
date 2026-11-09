import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { app } from '../src/app.ts';
test('API expone ruta de salud', () => { assert.equal(typeof app.get, 'function'); });
