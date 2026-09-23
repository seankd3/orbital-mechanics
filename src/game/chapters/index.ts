import type { Chapter } from '../chapter';
import { ENTRY, TEI } from './home';
import { DESCENT } from './descent';
import { ASCENT, DOI, RENDEZVOUS } from './lunar';
import { LOI, MIDCOURSE, TLI } from './outbound';

/** The Apollo 11 flight, in order. Each chapter starts where the last ended. */
export const CHAPTERS: Chapter[] = [TLI, MIDCOURSE, LOI, DOI, DESCENT, ASCENT, RENDEZVOUS, TEI, ENTRY];
