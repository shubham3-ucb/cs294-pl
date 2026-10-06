// Thursday ("The Humans"): every word the class sees, in order. The projector, the student page and the
// static deck (slides/build/build_thursday.py) all read this file, so they cannot drift apart.
// Copy uses **bold** and `code`. Paper numbers are the paper's own; "our re-run" numbers come from
// analysis/thursday_numbers.py on the authors' published data. Sarah = the course's User Studies lecture.

import fs from 'node:fs';

export const PAPER = {
  title: 'Do Developers Really Know How to Use Git Commands? A Large-Scale Study Using Stack Overflow',
  authors: 'Yang, Zhang, Pan, Xu, Zhou, Huang',
  venue: 'ACM TOSEM 2022',
  data: 'github.com/gitcommandstudy/gitcommands',
};

export const MESSAGE = 'Asking is not using.';

// The paper's survey, word for word from the authors' published form (Q1, the donation choice, is left out).
export const SURVEY = [
  { id: 'area', q: 'What is your professional area?', type: 'one',
    options: ['Academia (e.g., universities and research institutes)', 'Industry (e.g., companies and self-employed developers)'] },
  { id: 'degree', q: 'What is your highest degree?', type: 'one', options: ['Bachelor', 'Master', 'Ph.D.', 'Other (please specify)'] },
  { id: 'years', q: 'How many years have you been using Git?', type: 'number', min: 0, max: 40 },
  { id: 'level', q: 'Which of the following levels do you consider your ability to use Git to be?', type: 'one',
    options: ['Novice', 'Advanced beginner', 'Competent', 'Proficient', 'Expert'], why: 'Why (please specify)' },
  { id: 'learn', q: 'What are the main approaches you used to learn Git commands?', type: 'many',
    options: ['Learned during the class', 'Learned in online courses', 'Learned from peers or seniors',
      'Self-learned from the documentation', 'Self-learned from the internet (e.g., Q&A sites, blog, and video)', 'Other (please specify)'] },
  { id: 'tip', q: 'Do you have any suggestions for potential new developers on learning Git commands', type: 'text', optional: true },
];

// The paper's 92 respondents (Section 3.5, Table 7; the authors' RQ5 results file).
export const PAPER_SURVEY = {
  n: 92,
  level: [1, 26, 52, 11, 2], // Novice … Expert
  learn: [8, 10, 15, 76, 85, 3], // people who ticked each approach
  academia: 18,
  medianYears: 8,
};

export const POSTS = JSON.parse(fs.readFileSync(new URL('./thursday_posts.json', import.meta.url), 'utf8')).posts;
const ANSWER_ONLY = POSTS.filter((p) => !p.askerNamesIt).length;

// Group claims: the paper's own sentences. Groups take them in turn.
export const CLAIMS = [
  {
    id: 'experience', quote: 'This suggests that even developers with years of development experience can have trouble using Git commands.',
    where: 'RQ2 answer, §3.2',
    look: 'How did they measure experience? (§2.1 Step 4; §5)',
    measured: 'Years since the asker registered on Stack Overflow.',
    supports: 'Many Git questions come from Stack Overflow accounts that are years old.',
    why: 'Registration age is time on Stack Overflow, not experience with Git; §5 calls it a proxy. Experienced programmers can be new to Git: Paper 1 describes Microsoft teams switching from Source Depot and Team Foundation Server, for whom Git is "a small revolution". The data cannot tell "Git stays hard for experienced Git users" from "experienced programmers are new to Git".',
  },
  {
    id: 'difficulty', quote: '…for the more frequently-used commands, git credential and git submodule are among the most difficult ones.',
    where: '§1, finding (4); RQ4, §3.4',
    look: 'How does a post get counted for a command? Our re-run: 36.5% of all 80,370 Git questions have no accepted answer.',
    measured: 'The share of a command’s questions where the asker never marked an answer as accepted.',
    supports: 'These questions end without an accepted answer more often (43.0%, 37.5%) than Git questions overall (36.5%, our re-run).',
    why: 'An accepted answer is one click by the asker, and §5 notes askers may forget it. A post counted through its accepted answer has one by construction, so commands that appear in fixes look easy: git reflog lacks one in 20.7% of its posts, but in 46.3% of the posts whose asker names it (our re-run).',
  },
  {
    id: 'learning', quote: 'Self-learning is the primary learning approach.', where: 'Abstract; RQ5, §3.5',
    look: 'Who was invited, and how? (§2.2, Table 7)',
    measured: 'What 92 of 508 invited people ticked. The practitioners invited had recently asked a Git question on Stack Overflow.',
    supports: 'Most of these 92 say they learned from the internet (85) and the documentation (76).',
    why: 'The paper reports both 81.7% of 197 ticks and 85 of 92 people. Either way, the respondents were found through Stack Overflow, so they use the internet by construction, and “how I learned” is a memory.',
  },
  {
    id: 'trend', quote: 'the number of questions related to Git commands has been growing steadily', where: 'Conclusion, §7',
    look: 'Fig. 2(a), Table 1 and §3.1.',
    measured: 'Git questions per year (Fig. 2a), and their share of all Stack Overflow questions (Table 1).',
    supports: 'Questions peaked in 2016 (9,125), fell to 7,076 in 2019, then rose again. Their share has held at about 0.4% since 2010.',
    why: '§3.1 itself says the number "dropped a bit from 2017", and the RQ1 answer says "relatively stable". The conclusion and the paper’s own data disagree.',
  },
];

export const DESIGN_FIELDS = [
  { id: 'change', label: 'One change to Git', placeholder: 'e.g. what the user sees or types' },
  { id: 'rq', label: 'The study that would show it works', placeholder: 'Does … increase/decrease … for … doing …?' },
  { id: 'data', label: 'Your data', placeholder: 'Watch people, collect traces, or ask them? Which, exactly?' },
];

export const CLAIM_FIELDS = [
  { id: 'measured', label: 'What they measured', placeholder: 'The number behind the claim' },
  { id: 'supports', label: 'What the data supports', placeholder: 'The strongest sentence you would sign' },
];

const KIND = [
  'Need-finding: what problems do people have?',
  'Formative: which solution looks promising?',
  'Evaluative: did our tool work?',
];
const DATA = [
  'Observation: watching people use Git',
  'Traces: records left by real work',
  'Self-report: people telling us',
];

// kind: join · survey · slide · vote · reveal · label · group · break · exit · end
// shows: what a reveal adds from the class (votes of a scene, survey, labels, group answers, exit lines).
export const SCENES = [
  {
    id: 'join', kind: 'join', part: 'Thursday', title: 'The Humans', minutes: 2,
    lines: ['Open the link and type your first name.'],
    say: 'Tuesday we ran real Git. Today we judge a study of people asking about Git, then design with what survives. You leave with one new idea about tools for people.',
  },
  {
    id: 'survey', kind: 'survey', part: 'Be the data', title: 'Take the paper’s survey', minutes: 4,
    lines: ['The real questions, from the authors’ published form.', '92 developers answered them. You are next.'],
    say: 'Answer for yourself. The projector shows totals only. We will compare you with the paper’s 92.',
  },
  {
    id: 'paper', kind: 'slide', part: '1 · The question', title: 'The paper in one slide', minutes: 3,
    table: [
      ['RQ1 · How many Git questions?', '80,370 questions, 2008–2020. Since 2010, about 0.4% of all Stack Overflow questions each year.'],
      ['RQ2 · Who asks?', 'In 2020, 40.0% of Git askers had registered more than 5 years earlier (21.2% of all askers).'],
      ['RQ3 · Which commands?', 'Most viewed on average, among commands in 200+ questions: `git revert`, `git reflog`, `git stash`, `git clean`, `git reset`.'],
      ['RQ4 · Which are hardest?', 'Most often without an accepted answer: rare commands; among frequent ones, `git credential` and `git submodule`.'],
      ['RQ5 · How do people learn?', 'Survey, 92 of 508 invited: 81.7% of ticked approaches are self-learning.'],
    ],
    say: 'Sarah’s first rule: identify the research question first. Five RQs. Four come from Stack Overflow posts, one from a survey.',
  },
  {
    id: 'kind', kind: 'vote', part: '1 · The question', title: 'What kind of study is this?', minutes: 2,
    options: KIND,
    say: 'Vote on your laptop. Sarah’s three kinds.',
  },
  {
    id: 'kind-reveal', kind: 'reveal', part: '1 · The question', title: 'Need-finding', minutes: 3, shows: 'kind', correct: 0,
    lines: [
      'Its shape: what problems do developers face when using Git commands?',
      'A need-finding study must see what goes badly **and** what goes well. Stack Overflow questions record what people got stuck on; when Git just worked, nobody asked.',
    ],
    ask: 'Is the question interesting?',
    hope: 'Yes. Three of Stack Overflow’s five most-voted questions were about Git commands when the paper was written.',
    say: 'Need-finding, which Sarah also calls reconnaissance. Ask whether the question is interesting before judging the method.',
  },
  {
    id: 'data', kind: 'vote', part: '2 · The data', title: 'Stack Overflow posts are…', minutes: 2,
    options: DATA,
    say: 'Sarah’s ladder: watching beats traces, traces beat asking.',
  },
  {
    id: 'data-reveal', kind: 'reveal', part: '2 · The data', title: 'Traces. Of asking.', minutes: 3, shows: 'data', correct: 1,
    lines: [
      'Stack Overflow questions are on Sarah’s list of traces: better than asking people, worse than watching them.',
      'They record people asking, not people using Git. A common problem is asked once, then viewed millions of times.',
      'RQ5 is self-report. Nobody in this paper was watched using Git.',
    ],
    ask: 'Can this data answer “do developers know how to use Git commands?”',
    hope: 'No. It shows what people asked about, not what they can do.',
    say: 'Recruiting note (footnote 7): the authors found emails through GitHub accounts, say they were unaware that GitHub’s policy discourages emailing users this way, and recommend others not follow the practice.',
  },
  {
    id: 'survey-reveal', kind: 'reveal', part: '2 · The data', title: 'You and the paper’s 92', minutes: 4, shows: 'survey',
    lines: [
      '81.7% is 161 of 197 ticked boxes. By people: 85 of 92 ticked the internet.',
      'Invited: developers who had recently asked a Git question on Stack Overflow, plus some researchers. 92 of 508 answered.',
    ],
    ask: 'Which of these numbers would you trust? Did Tuesday change your answer?',
    hope: 'People found through Stack Overflow say they learn from the internet: the sample decides the answer. “How I learned” is a memory, and the options shape it.',
    say: 'Sarah: we could learn false things. Questions shape responses, and people have no durable, reliable memory of facts. “How I learned Git” is one of those memories.',
  },
  {
    id: 'label', kind: 'label', part: '3 · The analysis', title: `Check the rule on ${POSTS.length} real posts`, minutes: 9,
    lines: [
      'The paper’s rule: a post counts for every Git command in its question **or its accepted answer**.',
      'For each post: is it really a question about that command?',
    ],
    say: 'Eight posts, randomly sampled from the paper’s own data. Read the question first, then the answer.',
  },
  {
    id: 'label-reveal', kind: 'reveal', part: '3 · The analysis', title: 'The rule and you', minutes: 5, shows: 'labels',
    lines: [
      `The rule counts all ${POSTS.length} posts. In ${ANSWER_ONLY}, the command appears only in the answer.`,
      'Our re-run on all 80,370 posts: the command is only in the answer for 55% of `git reflog` posts, 44% of `git revert`, 44% of `git reset`.',
    ],
    ask: 'Did they measure “developers find this command hard”?',
    hope: 'They measured “this command appears near a question”. Often it is the fix, not the problem.',
    say: 'Sarah: have they operationalized their measure well? The post with 2.4 million views counts for git reflog only because of its answer.',
  },
  {
    id: 'views', kind: 'slide', part: '3 · The analysis', title: 'One question, 9.1 million views', minutes: 4,
    lines: [
      '“How do I undo the most recent local commits in Git?” names no command. Its accepted answer counts it for five. Without it, `git reflog` falls from #2 to #8.',
    ],
    table: [
      ['', 'Paper: mean views', 'Median views', 'Asker names it'],
      ['`git revert`', '#1', '#60', '#1'],
      ['`git reflog`', '#2', '#57', '#40'],
      ['`git stash`', '#3', '#39', '#6'],
      ['`git clean`', '#4', '#27', '#42'],
      ['`git reset`', '#5', '#43', '#4'],
    ],
    foot: 'Our re-run of the paper’s rule on its data. Rank among the 62 commands in 200+ questions, the paper’s filter.',
    ask: 'Do you believe their answer to RQ3?',
    hope: 'Partly. The most-viewed questions are about undo, even when the asker names the command. The typical undo question is not unusually viewed, and which command gets the credit depends on the rule.',
    say: 'Views are heavy-tailed: the median post of each of these commands has about 250 to 360 views (our re-run). Dropping each command’s single top post keeps all five in the top 5: undo questions really are the most viewed.',
  },
  {
    id: 'break', kind: 'break', part: 'Break', title: 'Break', minutes: 5,
    lines: ['5 minutes. Then groups.'],
    say: 'Groups form when you press Next.',
  },
  {
    id: 'claims', kind: 'group', part: '4 · Do you believe it?', title: 'Put one claim on trial', minutes: 8, fields: 'claim',
    lines: ['Your group gets one of the paper’s claims.', 'Write what they measured, then the strongest sentence the data supports.'],
    say: 'One claim per group. The paper is open on your laptops; the hint points to the section.',
  },
  {
    id: 'claims-reveal', kind: 'reveal', part: '4 · Do you believe it?', title: 'The verdicts', minutes: 6, shows: 'claims',
    lines: ['The title asks whether developers know how to use Git commands. Nothing in the paper watches anyone use one.'],
    ask: 'Which claim survives best?',
    hope: 'None, as written. Each shrinks to what was measured. Nobody was watched using Git.',
    say: 'Read each group’s sentence, then the model answer under it.',
  },
  {
    id: 'design', kind: 'group', part: '5 · Design', title: 'Design for the need that survived', minutes: 10, fields: 'design',
    lines: [
      'The need: undo. The most-viewed Git question asks how to undo the most recent local commits.',
      'Its accepted answer’s fix is `git reset HEAD~`. Its further reading points to `git reflog`: the record Git already keeps of where HEAD has been.',
    ],
    say: 'Sarah’s evaluative shape: does ⟨tool⟩ increase or decrease ⟨measure⟩ for ⟨audience⟩ doing ⟨task⟩? Then: how would you collect the data?',
  },
  {
    id: 'design-reveal', kind: 'reveal', part: '5 · Design', title: 'Your designs', minutes: 3, shows: 'design',
    ask: 'Which of these could you test by watching people?',
    hope: 'The ones with a measure you can see: time to recover, recoveries that succeed.',
    say: 'One group at a time: the change, the study, the data. Push on the data: watch, trace, or ask?',
  },
  {
    id: 'git-did', kind: 'slide', part: '5 · Design', title: 'What Git and Jujutsu did', minutes: 2,
    lines: [
      'Git 2.23 (2019) split `git checkout` into `git switch` and `git restore`. In 2020 a developer “working with Git for years” asked what `git checkout [file]` does next to `git restore`: the paper’s reference [41].',
      'Jujutsu (`jj`) logs every operation, and `jj undo` reverses the last one.',
    ],
    ask: 'Which data would convince Git’s maintainers your change works?',
    hope: 'Observation or traces of real use: time to recover, recoveries that succeed. Not a survey.',
    say: 'A new command makes new questions. Whether it helped is an evaluative question, and nobody answers it by counting posts.',
  },
  {
    id: 'exit', kind: 'exit', part: 'Exit', title: 'One new idea for building tools for people', minutes: 2,
    lines: ['One line, on your own.'],
    say: 'Sarah’s bar: nobody leaves without a new insight about designing tools for humans.',
  },
  {
    id: 'end', kind: 'end', part: 'Thursday', title: MESSAGE, minutes: 1, shows: 'exit',
    lines: ['Tuesday: flat history is data loss. Thursday: asking is not using.', 'Both: check what your data actually records before you believe it.'],
    say: 'Thank you. Export the answers from Details.',
  },
];

export const TOTAL_MINUTES = SCENES.reduce((n, s) => n + s.minutes, 0);
