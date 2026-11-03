import test from 'node:test';
import assert from 'node:assert/strict';
import {formatNumericInput,normalizeNumericInput} from '../src/lib/numeric-input';
test('numeric inputs show separators while preserving decimal edits',()=>{
 assert.equal(formatNumericInput('1234567'),'1,234,567');
 assert.equal(formatNumericInput('1234.50'),'1,234.50');
 assert.equal(formatNumericInput('1234.'),'1,234.');
 assert.equal(formatNumericInput(''),'');
 assert.equal(normalizeNumericInput('1,234,567.50'),'1234567.50');
 assert.equal(Number(normalizeNumericInput('1,234,567')),1234567);
});
test('negative, exponent and malformed edits are rejected instead of changing their numeric meaning',()=>{
 for(const invalid of ['-100','1e5','1.2.3','abc'])assert.equal(normalizeNumericInput(invalid),null);
});
