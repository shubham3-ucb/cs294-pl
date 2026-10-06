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

export const MESSAGE = 'What people ask shows where they get stuck, not what they can do.';
export const BUFFER_MINUTES = 6;

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
  { id: 'stuck', label: 'Stuck on it', short: 'Stuck', hint: 'The asker is asking about this command.' },
  { id: 'needs', label: 'Needs it but doesn’t know it', short: 'Needs it', hint: 'This command would solve their problem, but they do not know it.' },
  { id: 'unrelated', label: 'Not about it', short: 'Not about it', hint: 'The command is only mentioned; the post is about something else.' },
];

// The paper's Table 8: its six categories for 65 survey comments, and its seven example comments, word for word.
export const CATEGORIES = [
  'Learning and improving from practice',
  'Making the best use of the internet',
  'Understanding basic concepts and principles first',
  'Emphasizing the importance of Git',
  'Mastering only the basic commands',
  'Having the basic needs satisfied by Git GUI tools',
];
export const CATEGORY_COUNTS = [18, 17, 14, 9, 5, 2];
// In a fixed mixed order, so the paper's grouping is not visible.
export const COMMENTS = [
  { id: '56', category: 3, text: 'Git is an extremely important tool to our routine as software developers. I often use Git with GitHub, which makes the software development process a lot more comforting. I got started with Git by learning some simple commands when I was in college.' },
  { id: '32', category: 0, text: 'There are so many commands, I think it is better to learn them in practice instead of learning to master them at the beginning.' },
  { id: '89', category: 4, text: 'Git is not a tool you have to go pretty deep to learn. Since it is a fairly trivial tool, and its man page is not clear, I would recommend not spending too much time learning Git. I’ve been using Git for at least five years now, if not more. The only commands I’ve ever had to use are probably git pull, git push, git commit, and git rebase (in rare cases).' },
  { id: '26', category: 2, text: 'The difficulty with git is that when problems arise, you have to dive into the solutions in the tutorials, which is hard to do without understanding the basic concepts. At this point, if you don’t understand them you have to learn them all over again.' },
  { id: '21', category: 5, text: 'All I want is to concentrate on my development, and dump the code into a repository. I do not want to waste time learning all kinds of commands. I am quite satisfied with the existing graphical tools because they meet my needs.' },
  { id: '77', category: 0, text: 'Git is my VCS of choice, as I’ve learned how it works and have use for its power. But there is a quite high barrier for getting started with Git. I recommend learning to use the basic commands first, so you can keep improving your skills in practice.' },
  { id: '42', category: 1, text: 'Years on, I still constantly have to search the internet for help because it’s not intuitive. We must learn to build on the work of others. I prefer to find the answers I need online (like Stack Overflow) than its poor documentation.' },
];

// Group claims: the paper's own sentences. Groups take them in turn.
export const CLAIMS = [
  {
    id: 'experience', quote: 'This suggests that even developers with years of development experience can have trouble using Git commands.',
    where: 'RQ2, §3.2',
    facts: [
      'The authors measured experience as the years since the asker joined Stack Overflow.',
      'In 2020, 40.0% of Git askers had joined more than 5 years earlier. Among all Stack Overflow askers, 21.2% had.',
      'The authors themselves call this a stand-in for experience.',
      'Two askers are quoted saying they have programmed for years and still struggle with Git.',
    ],
    measured: 'The years since the asker joined Stack Overflow.',
    supports: 'Some people with old Stack Overflow accounts asked for help. The claim is true as written.',
    why: 'It holds because “can have trouble” asks for very little. But the age of an account is not Git experience: an experienced programmer can be new to Git, like the Microsoft teams in Tuesday’s paper.',
  },
  {
    id: 'difficulty', quote: '…for the more frequently-used commands, git credential and git submodule are among the most difficult ones.',
    where: '§1, finding 4; §3.4',
    facts: [
      '“Difficult” was measured as the share of a command’s questions where the asker never marked an answer as accepted.',
      'git credential: 43.0% of 328 questions. git submodule: 37.5% of 2,911. All Git questions together: 36.5% (our count on the paper’s data).',
      'A question counts for a command when the command’s name appears in the question or in its accepted answer.',
      'Accepting an answer is one click by the asker. The authors note askers may forget it.',
    ],
    measured: 'The share of a command’s questions that have no accepted answer.',
    supports: 'For git credential the share is above average (43.0% against 36.5% overall); for git submodule it is about average (37.5%).',
    why: 'Accepting an answer is one click by the asker, and it is often forgotten. And a post counted through its accepted answer has one by definition, so commands that appear in fixes look easy.',
  },
  {
    id: 'learning', quote: 'Self-learning is the primary learning approach.', where: 'Abstract; §3.5',
    facts: [
      'The survey was sent to 508 people. 92 answered.',
      'The people invited were developers who had recently asked a Git question on Stack Overflow, plus some researchers.',
      'Of all the learning approaches ticked, 81.7% were self-learning (161 of 197 ticks). By people: 85 of 92 ticked the internet, 76 the documentation.',
    ],
    measured: 'The boxes that 92 people ticked about how they learned Git.',
    supports: 'These 92 people say they learned mostly from the internet and the documentation.',
    why: 'Most of the 92 were found through Stack Overflow, so people who learn from the internet are over-represented. And how one learned Git is a memory, not a record.',
  },
  {
    id: 'selfrating', quote: 'This result, although surprising, is consistent with the conclusion we obtained in RQ2, indicating that even experienced developers still have doubts about Git usage.',
    where: '§3.5',
    facts: [
      'The 92 rated their own Git level on a five-step scale: novice, advanced beginner, competent, proficient, expert.',
      '79 of 92 chose competent or below. Many of them had used Git for more than five years.',
      'Nobody’s Git skill was tested.',
    ],
    measured: 'People rating their own Git level, from novice to expert.',
    supports: 'Most of the 92 rate themselves competent or below (79 of 92).',
    why: 'A self-rating is a judgment, moved by modesty and by the wording of the levels. It measures neither doubts nor skill.',
  },
];

export const CLAIM_FIELDS = [
  { id: 'supports', label: 'What do these facts really show?', placeholder: 'One sentence you would sign' },
  { id: 'missing', label: 'What would you need, to believe the claim as written?', placeholder: 'For example: watching people use Git, a tested measure, a different sample' },
];

export const DESIGN_FIELDS = [
  { id: 'change', label: 'Your change', placeholder: 'What the user would see or type' },
  { id: 'rq', label: 'How you would test it', placeholder: 'For example: does it cut the time to recover, and for whom?' },
  { id: 'measure', label: 'What you would measure, and one risk', placeholder: 'For example: time to recover; a risk is that people learn from the first try' },
  { id: 'data', label: 'How you would collect the data', placeholder: 'Would you watch people, log real use, or ask them?' },
];

// kind: join · survey · slide · reveal · label · code · group · break · exit · end
// shows: what a reveal adds from the class (survey, labels, codes, group answers, exit lines).
// Copy rules: plain titles that say what is on the slide; at most two short complete sentences; facts are told, not quizzed.
export const SCENES = [
  {
    id: 'join', kind: 'join', part: 'Thursday', title: 'A study of Git users', minutes: 3,
    lines: ['Open the link and type your first name.'],
    say: 'On Tuesday you used Git. Today we read a study of what people ask about Git: how it was done, then we check it ourselves, judge its claims, and design a better tool.',
  },
  {
    id: 'survey', kind: 'survey', part: 'Warm-up', title: 'Take the paper’s survey', minutes: 4,
    lines: ['These are the paper’s survey questions, which 92 developers answered.', 'Answer them for yourself on your laptop.'],
    say: 'These are the paper’s real survey questions. The projector shows totals only. We compare you with the 92 later.',
  },
  {
    id: 'how', kind: 'slide', part: '1 · The study', title: 'How the study was done', minutes: 4,
    table: [
      ['Collect', 'The authors collected 80,370 Stack Overflow questions about Git commands, asked between 2008 and 2020.'],
      ['Count', 'A question counts for a command when the command’s name appears in the question or in its accepted answer.'],
      ['Measure', 'For each command they measured how often its questions were viewed, and how often a question had no accepted answer.'],
      ['Survey', 'They also sent a survey to 508 developers, and 92 answered.'],
    ],
    say: 'Just tell them; there is no quiz here. Nobody was watched using Git: the data is questions people asked, plus a survey. The count is a text match; nobody reads a question to decide what it is about. Two raters did check that the questions are about Git commands at all (Cohen’s kappa 0.844). The survey went to recent Stack Overflow askers and some researchers.',
  },
  {
    id: 'paper', kind: 'slide', part: '1 · The study', title: 'What the paper found', minutes: 3,
    table: [
      ['How many', 'Git questions have been a steady 0.4% of all Stack Overflow questions each year since 2010.'],
      ['Who asks', 'Many askers have old Stack Overflow accounts. In 2020, 40% had joined more than 5 years earlier.'],
      ['Most viewed', 'The most-viewed commands are mostly about undoing work: `revert`, `reflog`, `stash`, `clean` and `reset`.'],
      ['Hardest', 'Rare commands most often lack an accepted answer. Among common commands, `credential` and `submodule` do.'],
      ['How people learn', 'The 92 surveyed say they learned mostly on their own: 81.7% of the boxes they ticked were self-learning.'],
    ],
    say: 'These are their five findings. “Most viewed” is an average over commands with 200 or more questions. “Hardest” means most often without an accepted answer. Today we check whether the data supports each one.',
  },
  {
    id: 'survey-reveal', kind: 'reveal', part: '1 · The study', title: 'Your answers next to the paper’s 92', minutes: 3, shows: 'survey',
    lines: ['The paper’s 92 were found mostly through Stack Overflow.', 'Their answers, like yours, are self-ratings and memories.'],
    ask: 'Would you trust your own answers?',
    hope: 'Not fully. A level is a judgment, and “how I learned” is a memory, shaped by the options on the form.',
    say: '81.7% is 161 of 197 ticked boxes; by people, 85 of 92 ticked the internet. Sarah’s point: the question shapes the answer, so be careful with self-ratings.',
  },
  {
    id: 'label', kind: 'label', part: '2 · Check it yourself', title: `Read ${POSTS.length} real posts`, minutes: 8,
    lines: ['The paper counted each of these posts as a question about one command.', 'Read each post on your laptop and pick one of the three labels.'],
    say: 'Real posts from the paper’s data, drawn at random from short, answered posts. Read the question, then the answer, then pick one label.',
  },
  {
    id: 'label-reveal', kind: 'reveal', part: '2 · Check it yourself', title: `Your labels for the ${POSTS.length} posts`, minutes: 4, shows: 'labels',
    lines: [`In ${ANSWER_ONLY} of the ${POSTS.length} posts, the command is named only in the accepted answer, not by the asker.`, `The paper still counts all ${POSTS.length} as questions about that command.`],
    ask: 'Did the paper measure which commands are hard?',
    hope: 'No. It measured where a command’s name appears.',
    say: '“Needs it but doesn’t know it” is real evidence too: it supports the paper’s idea of recommending commands (§4.1). Our re-run of their rule: the most-viewed question, “How do I undo the most recent local commits?” (9.1 million views), names no command; without it, git reflog falls from #2 to #8.',
  },
  {
    id: 'code', kind: 'code', part: '2 · Check it yourself', title: 'Sort 7 survey comments', minutes: 5,
    lines: ['The paper sorted the 65 comments from its survey into 6 categories.', 'On your laptop, put each of these 7 comments into one of those categories.'],
    say: 'These are the example comments from the paper’s Table 8. Work alone, quickly.',
  },
  {
    id: 'code-reveal', kind: 'reveal', part: '2 · Check it yourself', title: 'Your sorting next to the paper’s', minutes: 3, shows: 'codes',
    lines: ['The paper does not say how it sorted the comments, or whether two people agreed.', 'The usual practice is that two people sort independently, and the paper reports how often they agreed.'],
    ask: 'Would another team get the same categories?',
    hope: 'Maybe not. That is why you name a method and report agreement.',
    say: 'Sarah’s point: a feeling is not a method. The paper sorted 65 comments “for better delivery purposes”, with no method named. It did measure agreement elsewhere (Cohen’s kappa 0.844, §2.1).',
  },
  {
    id: 'break', kind: 'break', part: 'Break', title: 'Break', minutes: 5,
    lines: ['We take five minutes, then work in groups.'],
    say: 'Before you press Next: everyone opens the /thu tab again, and “here” on your console matches the room. Groups form when you press Next.',
  },
  {
    id: 'claims', kind: 'group', part: '3 · Judge it', title: 'Check one claim from the paper', minutes: 8, fields: 'claim',
    lines: ['Your group has one sentence from the paper, and the facts behind it.', 'Write what the facts really show, then what you would need to believe the claim.'],
    say: 'One claim per group. Everything they need is on their screen: the claim and the facts behind it. Nobody needs the paper.',
  },
  {
    id: 'claims-reveal', kind: 'reveal', part: '3 · Judge it', title: 'The four claims, and what the data supports', minutes: 5, shows: 'claims',
    lines: ['Nobody was watched using Git, so the data cannot answer the paper’s title.'],
    ask: 'Which claim holds up best?',
    hope: 'The experience claim, because it asks for little. The other three shrink to what was measured.',
    say: 'Read each group’s sentence, then the model answer. Students see the reasons on their laptops. Be fair: the authors flag the account-age proxy themselves (§5).',
  },
  {
    id: 'design', kind: 'group', part: '4 · Design', title: 'Design a better undo', minutes: 10, fields: 'design',
    lines: ['The most-viewed Git question asks how to undo the last commit.', 'Design one change, and say how you would test whether it helps.'],
    say: 'Ask them: why do people have to ask how to undo? The most-viewed question asks how to undo the last commit; its accepted answer’s fix is git reset HEAD~, and its further reading points to git reflog. Asking can find a need; only a test with real users shows that a fix works. Tuesday’s Safety diary was the reflog on screen.',
  },
  {
    id: 'design-reveal', kind: 'reveal', part: '4 · Design', title: 'Your designs', minutes: 3, shows: 'design',
    lines: [],
    ask: 'Which of these could you test by watching people?',
    hope: 'The ones with a measure you can see: time to recover, or recoveries that work.',
    say: 'One group at a time: change, test, measure and risk, data. Git itself added git switch and git restore in 2019; only a test with users could tell whether they helped. Jujutsu (jj) has an operation log and jj undo. In 2020 a developer “working with Git for years” asked what git checkout [file] does next to git restore (the paper’s reference [41]): new commands bring new questions.',
  },
  {
    id: 'verdict', kind: 'slide', part: 'Summary', title: 'What holds in the paper, and what does not', minutes: 3,
    columns: [
      { title: 'Holds', items: [
        'There are many Git questions, and their share is steady.',
        'Undoing work is a real need.',
        'Long-time Stack Overflow users can still get stuck.',
        'The data is public, and we could check it ourselves.',
      ] },
      { title: 'Does not hold as written', items: [
        'The hardness ranking counts a command in the fix as the problem.',
        'The most-viewed ranking rests on a few posts; one post lifts `reflog` from #8 to #2.',
        'That developers learn on their own was asked of people found on Stack Overflow.',
        'The comment categories have no stated method, and the “doubts” are self-ratings.',
        'The title’s question stays open, because nobody was watched.',
      ] },
    ],
    say: 'Be fair to the authors: finding needs from public data is useful, and they published their data. What breaks is turning counts of questions into claims about difficulty and skill.',
  },
  {
    id: 'exit', kind: 'exit', part: 'Summary', title: 'One idea to take home', minutes: 2,
    lines: ['On your laptop, finish this sentence in one line of your own.', 'When you build a tool for people, …'],
    say: 'Sarah’s bar: nobody leaves without a new idea about designing tools for people.',
  },
  {
    id: 'end', kind: 'end', part: 'Thursday', title: 'Thank you', minutes: 1, shows: 'exit',
    lines: [MESSAGE],
    say: 'Export the answers from Details, then Reset.',
  },
];

export const TOTAL_MINUTES = SCENES.reduce((n, s) => n + s.minutes, 0);
