import release from '../content/practice-v2.json';
import type {PracticeSet} from './study-types';

// Same immutable release is imported by the app and seeded into the server database.
export const practiceSets=release.sets as PracticeSet[];
export const getPracticeSets=(episode:string)=>practiceSets.filter(s=>s.episode===episode);
export const extraQuestions=(episode:string)=>getPracticeSets(episode).flatMap(s=>s.questions);
