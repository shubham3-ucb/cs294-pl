// Thursday: reading a user study, the way the course's User Studies lecture (Sarah) teaches it: find the research
// question, check whether the data can answer it, then decide whether you believe the analysis, and leave with a
// lesson for building tools. Every word the class sees, in order; the projector, the console and the student page
// all read this file. Copy uses **bold** and `code`. Paper numbers are the paper's own; "our re-run" numbers come
// from analysis/thursday_numbers.py on the authors' published data.

import fs from 'node:fs';

export const PAPER = {
  title: 'Do Developers Really Know How to Use Git Commands? A Large-Scale Study Using Stack Overflow',
  authors: 'Yang, Zhang, Pan, Xu, Zhou, Huang',
  venue: 'ACM TOSEM 2022',
  data: 'github.com/gitcommandstudy/gitcommands',
};

export const MESSAGE = 'Find the research question. Check whether the data can answer it. Then decide if you believe the answer.';
export const BUFFER_MINUTES = 4;

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

// Each real post, in plain words: what the asker wanted, and what the accepted answer told them. Written by us, not the paper.
const PLAIN = {
  12084583: 'They made some commits, undid two of them, and now want to get back to the commit called "updated from online". They pasted their reflog, the list of where they have been. The answer: check out that commit by its ID.',
  1505948: 'They ran `git add .` and staged too many files. They want to unstage one file without losing their edits. The answer: `git reset HEAD -- file` unstages it and keeps the changes.',
  2389361: 'They merged a branch by mistake and have not pushed yet. They want the merge gone; `git revert` only added another commit. The answer: find the commit before the merge in the reflog, then `git reset --hard` to it.',
  61221773: 'Two commits changed a file. They want to undo only the second commit and keep the first. The answer: `git revert` the second commit; it adds a new commit that cancels it.',
  8769377: 'They want to copy two files from one branch into another without bringing the rest. The answer: `git checkout branch1 -- file1 x/file2`, then commit. Their own workaround ends with `git clean -f`.',
  4339738: 'They made a new branch, tried things, switched back to master, and were surprised the new files were still there; `git reset --hard` did not remove them. The answer: the files were never committed, so Git does not touch them; `git stash` would have set them aside.',
  29230073: 'They pushed a bad commit, went back one commit and fixed the files, and do not know how to get the fix onto master. The answer: go to master, `git revert` the bad commit, push.',
  53168541: 'They ran `git checkout -- .` and wiped their uncommitted changes. They ask if there is any way back. The answer: only if they had run `git stash` first, or their editor keeps file history.',
};
export const POSTS = JSON.parse(fs.readFileSync(new URL('./thursday_posts.json', import.meta.url), 'utf8')).posts
  .map((p) => ({ ...p, plain: PLAIN[p.id] ?? '' }));
const ANSWER_ONLY = POSTS.filter((p) => !p.askerNamesIt).length;

// How students label a post the paper counted for a command.
export const LABELS = [
  { id: 'stuck', label: 'The person asked about it', short: 'Asked about it', hint: 'They were trying to use this command and asked how.' },
  { id: 'needs', label: 'The answer used it to fix something else', short: 'Used in the answer', hint: 'They did not ask about it. Someone gave it as the solution to their problem.' },
  { id: 'unrelated', label: 'It only appears in passing', short: 'In passing', hint: 'In pasted output or a side remark. Not asked about, and not the solution.' },
];


// ---------- Who works with whom ----------
// solo: each person · pair: 2 · team: about 4. Pairs and teams form the first time the class reaches a scene
// that needs them, from the people in the room; the teacher can re-form them.
export const SIZES = { pair: 2, team: 4 };
export const WHO_LINE = { solo: 'On your own', pair: 'With your partner', team: 'With your team' };

// ---------- Seven Git tasks: do you know how? ----------
// Each is a situation and four commands; one does what the situation asks. They use the commands the paper found
// people ask about most (§3.3: revert, reflog, stash, clean, reset) and one more everyday case (amending a commit).
export const SURE = ['Guessing', 'Fairly sure', 'Certain'];
export const TASKS = [
  { id: 'soft', short: 'Undo a commit you haven’t pushed, keep the changes',
    situation: 'You made a commit a minute ago and haven’t pushed it. You want to undo the commit but keep the changes in your files.',
    options: ['`git reset --soft HEAD~1`', '`git reset --hard HEAD~1`', '`git revert HEAD`', '`git checkout HEAD~1`'], key: 0 },
  { id: 'revert', short: 'Undo a commit your teammates already pulled',
    situation: 'You pushed a commit with a bug, and your teammates have already pulled it. You want to undo it without breaking their copies.',
    options: ['`git reset --hard HEAD~1`, then `git push --force`', '`git revert` the bad commit, then `git push`', '`git checkout HEAD~1`', '`git commit --amend`'], key: 1 },
  { id: 'amend', short: 'Add a forgotten file to your last commit',
    situation: 'You just committed and forgot one file, `notes.txt`. You haven’t pushed. You want `notes.txt` inside that same commit.',
    options: ['`git add notes.txt`, then `git commit`', '`git revert HEAD`', '`git add notes.txt`, then `git commit --amend --no-edit`', '`git stash`'], key: 2 },
  { id: 'unstage', short: 'Unstage a file but keep your edits',
    situation: 'You ran `git add .` and staged `secret.env` by mistake. You want it out of the next commit, but you want to keep the file exactly as it is.',
    options: ['`git rm secret.env`', '`git reset --hard`', '`git checkout -- secret.env`', '`git restore --staged secret.env`'], key: 3 },
  { id: 'reflog', short: 'Get back a commit lost after `reset --hard`',
    situation: 'You ran `git reset --hard` and lost a commit you needed. You want it back.',
    options: ['Run `git reflog`, find the commit, then `git reset --hard` to it', '`git revert HEAD`', '`git stash pop`', 'Nothing: the commit is gone for good'], key: 0 },
  { id: 'stash', short: 'Put unfinished work aside to switch branches',
    situation: 'You are halfway through a change that isn’t ready to commit. You need to switch to another branch for a quick fix, then come back to your work.',
    options: ['`git commit --amend`', '`git stash`, switch branches, later `git stash pop`', '`git reset --hard`', '`git clean -f`'], key: 1 },
  { id: 'clean', short: 'Delete untracked files',
    situation: 'Your folder is full of build files that Git has never tracked. You want to delete them.',
    options: ['`git rm -r build/`', '`git reset --hard`', '`git clean -f`', '`git stash`'], key: 2 },
];

// ---------- Sorting: the research questions, and the paper's measures ----------

export const RQ_KINDS = ['Need-finding', 'Formative', 'Evaluative'];
export const RQS = [
  { id: 'rq1', label: 'RQ1', text: 'How many questions about Git commands are asked on Stack Overflow, and is that number changing?', key: 0 },
  { id: 'rq2', label: 'RQ2', text: 'Are the people who ask new to Stack Overflow, or have they been on it for years?', key: 0 },
  { id: 'rq3', label: 'RQ3', text: 'Which commands come up in questions most, and which of those questions are viewed most?', key: 0 },
  { id: 'rq4', label: 'RQ4', text: 'Which commands’ questions most often go without an accepted answer?', key: 0 },
  { id: 'rq5', label: 'RQ5', text: 'How do developers learn Git commands? (asked in a survey)', key: 0 },
];

export const RUNGS = ['Watching people', 'Records people left behind', 'Asking people'];
export const MEASURES = [
  { id: 'views', text: 'How many times a question was viewed', key: 1 },
  { id: 'accepted', text: 'Whether a question has an accepted answer', key: 1 },
  { id: 'named', text: 'Which commands appear in a question or in its accepted answer', key: 1 },
  { id: 'joined', text: 'How many years ago the asker joined Stack Overflow', key: 1 },
  { id: 'level', text: 'How good developers say they are at Git', key: 2 },
  { id: 'learned', text: 'How developers say they learned Git', key: 2 },
];

// ---------- Claims to judge (teams): the paper's own sentences, and the facts behind them ----------
// Teams take them in turn. measured / supports / why are the model answer, shown only once teams have answered.
export const CLAIMS = [
  {
    id: 'experience', quote: 'This suggests that even developers with years of development experience can have trouble using Git commands.',
    where: 'RQ2, §3.2',
    facts: [
      'The authors used “years since the person joined Stack Overflow” as their measure of experience.',
      'In 2020, 40.0% of the people asking Git questions had joined more than 5 years earlier. For all Stack Overflow questions, it was 21.2%.',
      'The authors say themselves that account age only stands in for experience (§5).',
    ],
    measured: 'How many years ago each asker joined Stack Overflow.',
    supports: 'Some people with old Stack Overflow accounts asked Git questions. That is true as written, because “can have trouble” is a weak claim.',
    why: 'The measure doesn’t match the claim: an old account is not the same as years of Git experience.',
  },
  {
    id: 'difficulty', quote: '…for the more frequently-used commands, git credential and git submodule are among the most difficult ones.',
    where: '§1, finding 4; §3.4',
    facts: [
      'The authors measured “difficult” as the share of a command’s questions that have no accepted answer.',
      'git credential: 43.0% of 328 questions. git submodule: 37.5% of 2,911. All Git questions together: 36.5% (our count on the paper’s data).',
      'A question counts for a command if the command’s name appears in the question or in its accepted answer.',
      'Accepting an answer is one click by the person who asked, and people forget to do it (§5).',
    ],
    measured: 'The share of a command’s questions with no accepted answer.',
    supports: 'git credential questions go without an accepted answer a bit more often than average. git submodule is about average.',
    why: 'The measure doesn’t match the claim: a forgotten click is not difficulty, and a command that appears in the answer was the fix, not the problem.',
  },
  {
    id: 'learning', quote: 'Self-learning is the primary learning approach.', where: 'Abstract; §3.5',
    facts: [
      'The survey went to 508 people, mostly people who had recently asked a Git question on Stack Overflow. 92 answered.',
      'Of all the learning methods people ticked, 81.7% were learning on their own (161 of 197 ticks).',
      '85 of the 92 ticked “the internet”, and 76 of the 92 ticked “the documentation”.',
    ],
    measured: 'Which boxes 92 people ticked about how they remember learning Git.',
    supports: 'These 92 people say they learned mostly from the internet and the documentation.',
    why: 'The people studied don’t represent other developers: they were found through Stack Overflow, so they are people who learn online. And how you learned is a memory, not a record.',
  },
  {
    id: 'selfrating', quote: 'This result, although surprising, is consistent with the conclusion we obtained in RQ2, indicating that even experienced developers still have doubts about Git usage.',
    where: '§3.5',
    facts: [
      'The 92 people rated their own Git level on five steps: novice, advanced beginner, competent, proficient, expert.',
      '79 of the 92 picked “competent” or lower. Many of them had used Git for more than five years.',
      'Nobody’s Git skill was tested.',
    ],
    measured: 'How people rated their own Git level.',
    supports: 'Most of the 92 rate themselves “competent” or lower.',
    why: 'The measure doesn’t match the claim: rating yourself is a judgment, moved by modesty and by how the levels are worded. It measures neither doubt nor skill.',
  },
  {
    id: 'coding', quote: 'We received a total of 65 comments, which covered a number of different aspects. We have therefore further categorized these comments for better delivery purposes.',
    where: '§3.5, Table 8',
    facts: [
      '92 people left 65 optional comments in the survey.',
      'The authors sorted them into six groups, with counts from 18 down to 2.',
      'The paper doesn’t say who sorted them, how, or whether two people agreed.',
      'For a different part of the study (checking 600 questions), two authors worked separately and reported how often they agreed (Cohen’s kappa 0.844).',
    ],
    measured: 'Free-text comments, sorted into groups by the authors.',
    supports: 'People’s comments mention learning by practice, using the internet, and understanding the basics, among other things.',
    why: 'There is no stated method and no check that two people would sort them the same way, so another team could get different groups. The paper does this check elsewhere, so it knows how.',
  },
];

// ---------- What students write: each box has an id, its question, and its short name on the projector ----------

export const FIELDS = {
  plan: [{ id: 'plan', short: 'Plan', label: 'What data would you collect, and from whom?' }],
  rq: [
    { id: 'rq', short: 'Research question', label: 'Your research question:' },
    { id: 'use', short: 'What a tool builder would do', label: 'Once they knew the fix, what would a tool builder do differently?' },
  ],
  claim: [
    { id: 'measured', short: 'What they measured', label: '1. What exactly did the authors measure?' },
    { id: 'threat', short: 'Biggest problem', label: '2. What is the biggest problem with the claim? Pick one and say why: the measure doesn’t match the claim, the people studied don’t represent other developers, or the setting doesn’t match real work.' },
    { id: 'verdict', short: 'Do they believe it?', label: '3. Do you believe the claim? Say yes or no, or write a smaller claim that you do believe.' },
  ],
};

// Worked examples about something else, so nobody is handed their own answer.
export const EXAMPLES = {
  rq: {
    title: 'See an example',
    rows: [
      ['Example', 'When a spreadsheet formula shows an error, where do people look first?'],
      ['What a tool builder would do', 'Put the explanation where people already look, next to the cell, instead of in a help menu.'],
    ],
  },
  claim: {
    title: 'See an example (with a made-up claim)',
    intro: 'Claim: “Students find rebase harder than merge.” Facts: on the course forum, 30 questions mention rebase and 10 mention merge.',
    rows: [
      ['1. What they measured', 'How often each word appears in forum questions.'],
      ['2. Biggest problem', 'The measure doesn’t match the claim: a question that mentions rebase may be stuck on something else, and students who never post aren’t counted.'],
      ['3. Do they believe it?', 'A smaller claim: students ask about rebase more often than about merge.'],
    ],
  },
};

// ---------- The scenes ----------
// kind: join · tasks · write · discuss · slide · sort · survey · label · reveal · exit · end
//   tasks: TASKS, each a pick and how sure; its reveal shows 'tasks'
//   write: who (solo | pair | team), fields (a FIELDS key), example (an EXAMPLES key), assign ('claim')
//   discuss: from (a write scene's id, or 'questions'): the class's answers on the projector; the teacher stars some
//   sort: items and categories; reveal shows 'sort:<id>' · reveal: shows tasks | survey | labels | claims | sort:<id>
// Writing: plain words; say exactly what students answer; at most two short sentences on the projector.
export const SCENES = [
  {
    id: 'join', kind: 'join', title: 'Do developers really know how to use Git?', minutes: 3,
    lines: ['Go to the link below and type your first name.'],
    say: 'On Tuesday you used Git. Today we read a study about people using Git, and we judge it the way the User Studies lecture taught: first the research question, then the data, then the analysis. If a question comes up at any point, type it in the box at the bottom of your screen.',
  },
  {
    id: 'tasks', kind: 'tasks', title: 'Try seven Git tasks', minutes: 6,
    about: 'Each task describes a situation. Pick the command that does what the task asks, then say how sure you are.',
    lines: ['On your laptop: seven short Git tasks.', 'For each one, pick the command you would run and say how sure you are.'],
    say: 'Alone, no searching. It is fine to guess: say so with “Guessing”. These are the commands the paper found people ask about most.',
  },
  {
    id: 'tasks-reveal', kind: 'reveal', shows: 'tasks', title: 'How the class did on the tasks', minutes: 4,
    lines: ['For each task: how many of you picked the right command, and how often the people who were certain got it right.'],
    ask: 'Which task did the most people get wrong? Were the people who felt certain right more often than the people who guessed?',
    hope: 'Usually the undo tasks trip people up, and being certain does not always mean being right. That is why studies test people instead of only asking them.',
    say: 'This was a tiny version of the study the paper’s title asks for: we tested people on tasks. Keep the numbers in mind; the paper never tests anyone.',
  },
  {
    id: 'you-first', kind: 'write', who: 'solo', fields: 'plan', title: 'How would you study this?', minutes: 2,
    about: 'The paper asks whether developers really know how to use Git commands. If you had to answer the question for thousands of developers,',
    lines: ['How would you find out whether developers know how to use Git?', 'On your laptop: write what data you would collect, and from whom.'],
    say: 'Two minutes, alone. Any answer is fine; we come back to these.',
  },
  {
    id: 'you-first-discuss', kind: 'discuss', from: 'you-first', title: 'Your ideas', minutes: 3,
    lines: [],
    hope: 'Watching people is the strongest evidence, records are next, and asking people is the weakest. Most real studies mix them.',
    say: 'Ask: for each idea, does it watch people use Git, use records people leave behind (like posts or logs), or ask people questions? Star two or three different kinds of answer on the console, for example one that watches people and one that asks them.',
  },
  {
    id: 'rqs', kind: 'slide', title: 'What the authors asked', minutes: 2,
    lines: [],
    get table() { return RQS.map((q) => [q.label, q.text]); }, // read fresh, so an edit to a question shows here too
    say: 'Read them aloud. Point out that the title asks something different: whether developers know how to use Git.',
  },
  {
    id: 'rq-sort', kind: 'sort', items: 'rqs', title: 'What kind of question is each one?', minutes: 3,
    about: 'A **need-finding** question asks what problems people have.\nA **formative** question asks which solution to a known problem looks promising.\nAn **evaluative** question asks whether a solution we built actually works.',
    lines: ['On your laptop: for each research question, pick need-finding, formative or evaluative.'],
    say: 'Alone, quickly.',
  },
  {
    id: 'rq-reveal', kind: 'reveal', shows: 'sort:rq-sort', title: 'All five are need-finding', minutes: 3,
    lines: ['All five ask what problems people have. None of them tests a solution.'],
    ask: 'What research question would answer the title? What data would you need for it?',
    hope: 'Something like: can developers do common Git tasks correctly? To answer it you have to test or watch people, like our seven tasks did.',
    say: 'Need-finding studies are useful: they point at problems worth solving. What matters is whether this one’s answers help someone build a better tool.',
  },
  {
    id: 'rq-pair', kind: 'write', who: 'pair', fields: 'rq', example: 'rq', title: 'What research questions would you ask?', minutes: 4,
    about: 'Work with a partner. Write one research question you wish the authors had asked. Then write what a tool builder would do differently once they knew the fix.',
    lines: ['With your partner: write one research question you wish the authors had asked.'],
    say: 'Pairs form when you press Next; each student sees their partner’s name. One person types.',
  },
  {
    id: 'rq-discuss', kind: 'discuss', from: 'rq-pair', title: 'Your research questions', minutes: 3,
    lines: [],
    ask: 'Which kind is each question: need-finding, formative or evaluative? Could the paper’s Stack Overflow data answer it?',
    hope: 'Most questions a tool builder cares about need people to be watched or tested. Stack Overflow posts answer only a few of them.',
    say: 'Star the questions worth discussing, and ask the pair behind one of them to explain it.',
  },
  {
    id: 'survey', kind: 'survey', title: 'Take the paper’s survey', minutes: 3,
    lines: ['These are the survey questions the authors sent to developers. 92 people answered them.', 'Answer them yourself, on your laptop.'],
    say: 'Don’t explain the survey. Let them experience answering it; we look at it from the inside in a moment.',
  },
  {
    id: 'data', kind: 'slide', title: 'Where the paper’s data came from', minutes: 3,
    table: [
      ['Questions', '80,370 Stack Overflow questions from 2008 to 2020. Each is tagged “git” and names a Git command in the question or in its accepted answer.'],
      ['A check', 'Two authors checked 600 of the questions by hand to make sure they were really about Git commands.'],
      ['Measures', 'How popular a command is: views, favorites and votes. How hard it is: questions with no accepted answer, no answer at all, or a slow one.'],
      ['Survey', 'Sent to 508 people, mostly people who had recently asked a Git question on Stack Overflow. 92 answered.'],
    ],
    lines: ['Nobody in this study was watched using Git.'],
    say: 'Footnote 7: the authors found people’s emails through GitHub, which goes against GitHub’s policy, and they tell other researchers not to do it. Who you invite shapes who answers: here, people who ask on Stack Overflow.',
  },
  {
    id: 'survey-reveal', kind: 'reveal', shows: 'survey', title: 'Your survey answers next to the paper’s', minutes: 3,
    lines: ['Your Git level is your own judgment, and how you learned Git is a memory.'],
    ask: 'How did you decide on your Git level? Would you have picked the same level if your advisor were reading your answer?',
    hope: 'We compared ourselves with other people, and who is reading changes the answer. Self-ratings measure how people see themselves, not their skill. Compare with the task results: were the confident people right?',
    say: 'The lecture’s point: how a question is asked shapes the answer, and people don’t keep an accurate record of their own past.',
  },
  {
    id: 'ladder-sort', kind: 'sort', items: 'measures', title: 'What kind of data is each measure?', minutes: 3,
    about: 'Data about people comes in three kinds, from strongest to weakest: **watching people** use the tool; **records people left behind** while they worked, such as posts, commits or logs; and **asking people**, in surveys or interviews. For each measure the paper uses, pick which kind it is.',
    lines: ['On your laptop: for each of the paper’s measures, pick watching people, records people left behind, or asking people.'],
    say: 'Alone, quickly.',
  },
  {
    id: 'ladder-reveal', kind: 'reveal', shows: 'sort:ladder-sort', title: 'Nobody was watched', minutes: 3,
    lines: ['Four of the measures are records people left behind. Two come from asking people.', 'Without watching people, a study can miss things, get things wrong, or see things only roughly.'],
    ask: 'Give one example of each from this paper: something it misses, something it could get wrong, and something it sees only roughly.',
    hope: 'Misses: people who are stuck but never post, or who use a GUI. Wrong: a post counted for a command that only appears in the answer. Roughly: what people tried before they asked.',
    say: 'Give the paper credit first: Stack Overflow posts are real questions from real work, not memories. Then the three ways it can still fall short.',
  },
  {
    id: 'analysis', kind: 'slide', title: 'Four things to check in any analysis', minutes: 2,
    table: [
      ['Measure', 'Does what they counted actually match what they claim?'],
      ['Writing', 'Does each sentence say only what the numbers show?'],
      ['Sorting text', 'If they sorted comments into groups, did they say how, and did two people agree?'],
      ['Reach', 'Would the result hold for other people, and for real work?'],
    ],
    lines: ['We use the first check right now, on real posts.'],
    say: 'Four checks from the lecture. The first one is next.',
  },
  {
    id: 'label', kind: 'label', title: 'Check what the paper counted', minutes: 6,
    about: 'The paper counted a post as a question about a command whenever the command’s name appeared anywhere in the question or in its accepted answer. Below are 8 of those posts, each with the command it was counted for. Read each post, then pick which of three things is true about that command.',
    lines: ['The paper counted each of these 8 posts as a question about one command.', 'On your laptop: read each post, and say whether the person asked about that command, the answer used it, or it only appears in passing.'],
    say: 'Real posts from the paper’s data, picked at random from short posts that have an accepted answer. Talking to a neighbour is fine; the answer is your own.',
  },
  {
    id: 'label-reveal', kind: 'reveal', shows: 'labels', title: 'What the paper actually counted', minutes: 4,
    lines: [`In ${ANSWER_ONLY} of the ${POSTS.length} posts, the command appears only in the accepted answer.`, 'The paper still counts every one of them as a question about that command.'],
    ask: 'If you wanted to measure which commands are hard, what would you count instead? What would your count still miss?',
    hope: 'Posts where the person names the command and is stuck on it. It would still miss everyone who never posts, so you would also need to watch or test people.',
    say: '“The answer used it” still tells you something: it supports the paper’s idea of recommending commands to people (§4.1). Our re-run of their rule: the most-viewed question, “How do I undo the most recent local commits?” (9.1 million views), names no command; without it, git reflog falls from #2 to #8 in views.',
  },
  {
    id: 'claims', kind: 'write', who: 'team', fields: 'claim', example: 'claim', assign: 'claim', title: 'Judge one of the paper’s claims', minutes: 8,
    about: 'Your team gets one claim from the paper and the facts behind it. Answer the three questions below, together. Write one answer for the team.',
    lines: ['Each team has one claim from the paper and the facts behind it.', 'Answer three questions: what did they measure, what is the biggest problem, and do you believe it?'],
    say: 'Teams of about four form when you press Next. Everything they need is on their screens; nobody needs the paper.',
  },
  {
    id: 'claims-reveal', kind: 'reveal', shows: 'claims', title: 'The claims, and what the data supports', minutes: 3,
    lines: ['Posts and a survey can show what problems people have. They can’t show who knows how to use Git.'],
    ask: 'Which claim held up best, and why?',
    hope: 'The experience claim, because it claims very little. The claims about difficulty, learning and skill shrink to what was actually measured.',
    say: 'Read each team’s verdict, then the model answer. Be fair: the authors name some of these problems themselves (§5).',
  },
  {
    id: 'questions', kind: 'discuss', from: 'questions', title: 'Your questions', minutes: 3,
    lines: ['Questions you sent during class.'],
    say: 'Star questions on the console as they come in during class; this slide shows the starred ones. Take two or three, and let the class try to answer before you do.',
  },
  {
    id: 'exit', kind: 'exit', title: 'One thing to take away', minutes: 2,
    about: 'Finish this sentence in one line: When you build a tool for people, …',
    lines: ['On your laptop, finish this sentence in one line:', 'When you build a tool for people, …'],
    say: 'The lecture’s goal: everyone leaves with one new idea about designing tools for people.',
  },
];

// Items to sort, each with its text's address for editing. The research questions show their label (RQ1…).
export const ITEMS = {
  rqs: { items: RQS, categories: RQ_KINDS, root: 'RQS', catRoot: 'RQ_KINDS' },
  measures: { items: MEASURES, categories: RUNGS, root: 'MEASURES', catRoot: 'RUNGS' },
};
export const TOTAL_MINUTES = SCENES.reduce((n, s) => n + s.minutes, 0);
