import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseProposal, decisionRequest, validatedProbabilities } from '../src/pipeline.ts'

const beer = { description: 'A glass of beer on a pub table.', uncertainty: '', action: 'Enjoy your beer', evidence: 'A glass of beer' }
test('novel activity reaches Laya without a fixed action vocabulary', () => {
  const scene = parseProposal(JSON.stringify(beer))
  const request = decisionRequest(scene)
  assert.equal(request.questions.decision.criteria.activity, beer.action)
  assert.equal(Object.keys(request.questions.decision.criteria).length, 5)
  assert.match(request.state, /glass of beer/)
  assert.ok(!('images' in request))
})
test('uncertainty survives the text boundary', () => {
  const scene = { ...beer, description: 'A glass of amber liquid.', uncertainty: 'The drink cannot be identified.', action: 'Enjoy your drink' }
  assert.match(decisionRequest(scene).state, /cannot be identified/)
})
test('unsupported or malformed scene never becomes a decision', () => {
  for (const value of ['invalid', 'null', '{}', JSON.stringify({ ...beer, action: '' }), JSON.stringify({ ...beer, evidence: '' }), JSON.stringify({ ...beer, action: 'Go left' }), JSON.stringify({ ...beer, description: 4 })]) {
    assert.throws(() => parseProposal(value))
  }
})
test('stable choice IDs map probabilities to the generated display label', () => {
  const p = validatedProbabilities({ left: .1, right: .1, forward: .1, back: .1, activity: .6 }, beer.action)
  assert.equal(p['Enjoy your beer'], .6)
  assert.equal(p['Go left'], .1)
})
test('missing, corrupt or unnormalized distributions are rejected', () => {
  for (const p of [null, {}, { left: .1, right: .1, forward: .1, back: .1 }, { left: .1, right: .1, forward: .1, back: .1, activity: NaN }, { left: 0, right: 0, forward: 0, back: 0, activity: 0 }, { left: .2, right: .2, forward: .2, back: .2, activity: .2, other: 0 }]) {
    assert.throws(() => validatedProbabilities(p, beer.action))
  }
})
