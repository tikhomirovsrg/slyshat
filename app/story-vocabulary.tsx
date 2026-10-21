'use client';
import {useState} from 'react';
import type {StoryVocabularyEntry} from '../lib/story-vocabulary';

export function StoryVocabulary({entries,language,initiallyOpen}:{entries:StoryVocabularyEntry[];language:string;initiallyOpen:boolean}){
 const [open,setOpen]=useState(initiallyOpen);
 if(!entries.length)return null;
 return <details className="story-vocabulary" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><span>Перед прослушиванием</span><strong>{entries.length} полезных выражения</strong></summary>
  <div className="story-vocabulary-body"><p>Прочитай и попробуй узнать их на слух в истории.</p><dl>{entries.map(entry=><div key={entry.term}><dt lang={language}>{entry.term}</dt><dd lang="ru">{entry.ru}</dd></div>)}</dl></div>
 </details>;
}
