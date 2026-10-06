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
export const BUFFER_MINUTES = 3;

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

// How students label a post the paper counted for a command.
export const LABELS = [
  { id: 'stuck', label: 'Stuck on it', short: 'Stuck', hint: 'They ask about this command.' },
  { id: 'needs', label: 'Needs it, doesn’t know it', short: 'Needs it', hint: 'It would fix their problem; they don’t know it.' },
  { id: 'unrelated', label: 'Not about it', short: 'Not about it', hint: 'It is only mentioned.' },
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
    look: 'How did they measure experience? (§2.1 Step 4, §5)',
    measured: 'Years since the asker joined Stack Overflow.',
    supports: 'Some long-time users had trouble. True, as written.',
    why: 'It holds because “can have trouble” is a weak claim. Account age is not Git experience: experienced programmers can be new to Git, like Paper 1’s Microsoft teams.',
  },
  {
    id: 'difficulty', quote: '…for the more frequently-used commands, git credential and git submodule are among the most difficult ones.',
    where: '§1, finding 4; §3.4',
    look: 'Hint: 36.5% of all Git questions have no accepted answer.',
    measured: 'The share of a command’s questions with no accepted answer.',
    supports: 'credential is above average (43.0% vs 36.5%); submodule is about average (37.5%).',
    why: 'An accepted answer is one click by the asker, often forgotten (§5). And a post counted through its answer always has one, so commands that appear in fixes look easy.',
  },
  {
    id: 'learning', quote: 'Self-learning is the primary learning approach.', where: 'Abstract; §3.5',
    look: 'Who was asked, and how were they found? (§2.2)',
    measured: 'What 92 people ticked about how they learned.',
    supports: 'These 92 say they learned mostly from the internet and the docs.',
    why: 'Most were found through Stack Overflow, so of course they use the internet. And “how I learned” is a memory.',
  },
  {
    id: 'selfrating', quote: 'This result, although surprising, is consistent with the conclusion we obtained in RQ2, indicating that even experienced developers still have doubts about Git usage.',
    where: '§3.5',
    look: 'What is the evidence for “doubts”? (§3.5, Fig. 4)',
    measured: 'People rating their own Git level, novice to expert.',
    supports: 'Most of the 92 rate themselves competent or below (79 of 92).',
    why: 'A self-rating is a judgment: modesty and the labels move it. It measures neither doubts nor skill.',
  },
];

export const CLAIM_FIELDS = [
  { id: 'measured', label: 'What they measured', placeholder: 'The number behind the claim' },
  { id: 'supports', label: 'What it really shows', placeholder: 'One sentence you would sign' },
];

export const DESIGN_FIELDS = [
  { id: 'change', label: 'Your fix', placeholder: 'What the user sees or types' },
  { id: 'rq', label: 'How you would test it', placeholder: 'Does it cut the time to recover for …?' },
  { id: 'measure', label: 'What you measure, and one risk', placeholder: 'e.g. time to recover; risk: people learn from the first try' },
  { id: 'data', label: 'How you collect it', placeholder: 'Watch people, log real use, or ask them?' },
];

const WHO = [
  'People watched while they used Git',
  'People who asked on Stack Overflow, plus 92 surveyed',
  'Git’s own usage logs',
];
const RULE = [
  'Someone reads it and decides',
  '`git reset` appears in the question or its accepted answer',
  'The asker tags it “reset”',
];

// kind: join · survey · slide · vote · reveal · label · code · group · break · exit · end
// shows: what a reveal adds from the class (votes of a scene, survey, labels, codes, group answers, exit lines).
// Copy rules: a title of six words or fewer; at most two short lines; one idea per line; plain words.
export const SCENES = [
  {
    id: 'join', kind: 'join', part: 'Thursday', title: 'The Humans', minutes: 3,
    lines: ['Open the link. Type your first name.'],
    say: 'Tuesday you used Git. Today we look at a study of people asking about Git: how it was done, whether its claims hold, and what a better tool would be.',
  },
  {
    id: 'survey', kind: 'survey', part: 'Warm-up', title: 'Take the paper’s survey', minutes: 4,
    lines: ['The same questions it asked 92 developers.', 'Answer for yourself.'],
    say: 'These are the paper’s real survey questions. The projector shows totals only. We compare you with the 92 later.',
  },
  {
    id: 'how', kind: 'slide', part: '1 · The study', title: 'How the study was done', minutes: 3,
    table: [
      ['Collect', '80,370 Stack Overflow questions about Git commands, 2008 to 2020.'],
      ['Measure', 'Per command: how often viewed (popular), and how often no answer was accepted (hard).'],
      ['Ask', 'A survey: 508 invited, 92 answered.'],
    ],
    say: 'No judging yet: this is what they did. Collect: all 198,626 questions tagged git; they kept those whose question or accepted answer names a Git command. Measure: also how long each asker had been on Stack Overflow. Ask: the invited were recent Stack Overflow askers and some researchers.',
  },
  {
    id: 'who', kind: 'vote', part: '1 · The study', title: 'Who is in this study?', minutes: 2,
    options: WHO,
    say: 'Vote on your laptop.',
  },
  {
    id: 'who-reveal', kind: 'reveal', part: '1 · The study', title: 'People who asked. Nobody was watched.', minutes: 2, shows: 'who', correct: 1,
    lines: ['Questions people asked, plus a survey.', 'Asking shows where people got stuck, not what they do.'],
    ask: 'What would watching show that asking can’t?',
    hope: 'What people actually do, including mistakes they never ask about.',
    say: 'In Sarah’s terms: need-finding, from traces of asking, plus self-report. Her ladder: watching beats traces, traces beat asking.',
  },
  {
    id: 'rule', kind: 'vote', part: '1 · The study', title: 'When does a question count for `git reset`?', minutes: 2,
    options: RULE,
    say: 'Vote. This one rule decides every ranking in the paper.',
  },
  {
    id: 'rule-reveal', kind: 'reveal', part: '1 · The study', title: 'A word search', minutes: 2, shows: 'rule', correct: 1,
    lines: ['Even if `git reset` appears only in the accepted answer, it counts.', 'Nobody reads the question to decide.'],
    ask: 'What could go wrong?',
    hope: 'The fix in the answer gets counted as the problem.',
    say: 'They did check, with two raters, that the questions are about Git commands at all (Cohen’s kappa 0.844), but not which command each one is about. In fifteen minutes the class checks the rule on real posts.',
  },
  {
    id: 'paper', kind: 'slide', part: '1 · The study', title: 'What they found', minutes: 2,
    table: [
      ['How many', '80,370 questions: a steady 0.4% of Stack Overflow since 2010.'],
      ['Who asks', 'Many long-time users: in 2020, 40% had joined Stack Overflow more than 5 years earlier.'],
      ['Most viewed', 'Mostly undo: `revert`, `reflog`, `stash`, `clean`, `reset`.'],
      ['Hardest', 'Rare commands; then `credential` and `submodule`.'],
      ['How people learn', 'Mostly on their own: 81.7% of ticked answers.'],
    ],
    say: 'Their five findings. Most viewed is an average over commands in 200+ questions. Hardest means most often without an accepted answer. Today we check whether the data supports them.',
  },
  {
    id: 'survey-reveal', kind: 'reveal', part: '1 · The study', title: 'You and the paper’s 92', minutes: 3, shows: 'survey',
    lines: ['The 92 were found mostly through Stack Overflow.', 'Self-ratings and memories are shaky data.'],
    ask: 'Would you trust your own answers?',
    hope: 'Not fully. A level is a judgment; “how I learned” is a memory, shaped by the options.',
    say: '81.7% is 161 of 197 ticked boxes; by people, 85 of 92 ticked the internet. Sarah: we can learn false things; questions shape answers; be nervous about self-ratings.',
  },
  {
    id: 'label', kind: 'label', part: '2 · Check it yourself', title: `Read ${POSTS.length} real posts`, minutes: 8,
    lines: ['Each was counted for one command.', 'Is the asker stuck on it?'],
    say: 'Real posts from the paper’s data, drawn at random from short, answered posts. Read the question, then the answer, then pick one label.',
  },
  {
    id: 'label-reveal', kind: 'reveal', part: '2 · Check it yourself', title: 'What the word search missed', minutes: 4, shows: 'labels',
    lines: [`In ${ANSWER_ONLY} of ${POSTS.length}, the command is only in the answer.`, `The rule still counts all ${POSTS.length} as questions about it.`],
    ask: 'Did they measure what’s hard?',
    hope: 'No. They measured where a command’s name appears.',
    say: '“Needs it, doesn’t know it” is real evidence too: it supports the paper’s idea of recommending commands (§4.1). Our re-run of their rule: the most-viewed question, “How do I undo the most recent local commits?” (9.1 million views), names no command; without it, git reflog falls from #2 to #8.',
  },
  {
    id: 'code', kind: 'code', part: '2 · Check it yourself', title: 'Sort 7 survey comments', minutes: 5,
    lines: ['The paper sorted comments into 6 groups.', 'Sort them yourself. Then compare.'],
    say: 'These are the example comments from the paper’s Table 8. Work alone, quickly.',
  },
  {
    id: 'code-reveal', kind: 'reveal', part: '2 · Check it yourself', title: 'Did you agree?', minutes: 3, shows: 'codes',
    lines: ['The paper never says how it sorted, or if two people agreed.', 'Good practice: two people sort, then report agreement.'],
    ask: 'Would another team get the same groups?',
    hope: 'Maybe not. That is why you name a method and report agreement.',
    say: 'Sarah: vibes are not an answer. The paper sorted 65 comments “for better delivery purposes”, with no method named. It did measure agreement elsewhere (Cohen’s kappa 0.844, §2.1).',
  },
  {
    id: 'break', kind: 'break', part: 'Break', title: 'Break', minutes: 5,
    lines: ['5 minutes. Then groups.'],
    say: 'Before you press Next: everyone opens the /thu tab again, and “here” on your console matches the room. Groups form when you press Next.',
  },
  {
    id: 'claims', kind: 'group', part: '3 · Judge it', title: 'Put one claim on trial', minutes: 7, fields: 'claim',
    lines: ['Your group gets one claim. One person types.', 'Write what they measured. Then what it really shows.'],
    say: 'One claim per group. The paper is open on their laptops; the hint points to the section.',
  },
  {
    id: 'claims-reveal', kind: 'reveal', part: '3 · Judge it', title: 'The verdicts', minutes: 5, shows: 'claims',
    lines: ['The title asks if developers know how to use Git. Nobody was watched.'],
    ask: 'Which claim holds up best?',
    hope: 'The experience claim, because it is weak. The other three shrink to what was measured.',
    say: 'Read each group’s sentence, then the model answer. Students see the reasons on their laptops. Be fair: the authors flag the account-age proxy themselves (§5).',
  },
  {
    id: 'design', kind: 'group', part: '4 · Design', title: 'Design a better undo', minutes: 9, fields: 'design',
    lines: ['Undo is the most-viewed Git question.', 'Why do people have to ask? Design one fix, and a test.'],
    say: 'The most-viewed question asks how to undo the last commit; its accepted answer’s fix is git reset HEAD~, and its further reading points to git reflog. Asking can find a need; only a test with real users shows a fix works. Tuesday’s Safety diary was the reflog on screen.',
  },
  {
    id: 'design-reveal', kind: 'reveal', part: '4 · Design', title: 'Your designs', minutes: 3, shows: 'design',
    lines: ['Git added `switch` and `restore` in 2019. Did they help? Only a test with users can say.'],
    ask: 'Which could you test by watching people?',
    hope: 'The ones with a measure you can see: time to recover, recoveries that work.',
    say: 'One group at a time: fix, test, measure and risk, data. Jujutsu (jj) has an operation log and jj undo. In 2020 a developer “working with Git for years” asked what git checkout [file] does next to git restore (the paper’s reference [41]): new commands make new questions.',
  },
  {
    id: 'verdict', kind: 'slide', part: 'End', title: 'What holds, what doesn’t', minutes: 2,
    columns: [
      { title: 'Holds', items: [
        'Git questions are many, and steady.',
        'Undo is a real need.',
        'Long-time users can struggle.',
        'The data is public. We checked it.',
      ] },
      { title: 'Doesn’t hold, as written', items: [
        '“Hardest commands”: fixes counted as problems.',
        'The ranking: one post moves `reflog` from #8 to #2.',
        '“Learn on their own”: asked of people found on Stack Overflow.',
        'The comment groups and “doubts”: no method, self-ratings.',
        'The title’s question: nobody was watched.',
      ] },
    ],
    say: 'Fair to the authors: finding needs from public data is useful, and they published it. What breaks is turning counts of asking into claims about difficulty and skill.',
  },
  {
    id: 'exit', kind: 'exit', part: 'End', title: 'One idea to take home', minutes: 2,
    lines: ['When you build a tool for people, …', 'One line, on your own.'],
    say: 'Sarah’s bar: nobody leaves without a new idea about designing tools for people.',
  },
  {
    id: 'end', kind: 'end', part: 'Thursday', title: MESSAGE, minutes: 1, shows: 'exit',
    lines: ['Check what your data really records.'],
    say: 'Thank you. Export the answers from Details, then Reset.',
  },
];

export const TOTAL_MINUTES = SCENES.reduce((n, s) => n + s.minutes, 0);
