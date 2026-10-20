const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
function importedJson(modulePath) {
  const source = fs.readFileSync(path.join(root, modulePath), 'utf8');
  return [...source.matchAll(/import \w+ from '([^']+\.json)'/g)].map(m => read(path.join(path.dirname(modulePath), m[1])));
}
const plan = read('content/planning.json');
const episodes = importedJson('app/episodes.ts');
const packs = importedJson('app/packs.ts');
const byId = new Map(episodes.map(e => [e.id, e]));
const packById = new Map(packs.map(p => [p.episode, p]));
assert.equal(plan.rows.length, 200);
assert.equal(new Set(plan.rows.map(r => r.id)).size, 200);
assert.equal(new Set(plan.rows.map(r => r.language + ':' + r.title)).size, 200);
assert.equal(episodes.length, 40);
for (const [language, levels] of Object.entries(plan.targets)) {
  for (const [level, count] of Object.entries(levels)) assert.equal(plan.rows.filter(r => r.language === language && r.level === level).length, count);
}
const stories = plan.rows.map(r => {
  const content = byId.get(r.id) || null;
  const practice = packById.get(r.id) || null;
  assert.equal(Boolean(content), r.release === 0, r.id);
  assert.equal(Boolean(practice), r.release === 0, r.id);
  if (content) { assert.equal(content.language, r.language); assert.equal(practice.level, r.level); }
  return {
    id: r.id, language: r.language, title: r.title, targetLevel: r.level,
    practiceLevel: practice?.level || null, listeningLevel: null,
    status: content ? 'available' : 'planned', releaseNumber: r.release,
    series: r.arc || '', learningGoal: r.listen, brief: r,
    content, practice, contentVersion: content?.version || 1
  };
});
const seed = {formatVersion: 1, seedId: plan.seedId, updatedAt: plan.updatedAt, stories,
  documents: [{id: 'development-roadmap-200', title: plan.title, markdown: plan.roadmapMarkdown,
    metadata: {sourcePage: plan.pageUrl, targets: plan.targets, availableStories: 40, plannedStories: 160}, version: 1}]};
// Historical seed bytes must not change: deployed databases validate its checksum.
assert.equal(fs.readFileSync(path.join(root, 'content/catalog-v1.json'), 'utf8'), JSON.stringify(seed, null, 2) + '\n', 'Historical catalog-v1 is immutable. Add a versioned release for new content.');
require('./validate-practice.cjs');
console.log('Historical seed verified: 200 stories (40 available, 160 planned), 1 roadmap.');
