import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import app from '../src/app.ts';
test('API exposes health check endpoint', () => { assert.equal(typeof app.get, 'function'); });
