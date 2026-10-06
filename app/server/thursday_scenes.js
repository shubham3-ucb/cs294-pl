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

export const POSTS = JSON.parse(fs.readFileSync(new URL('./thursday_posts.json', import.meta.url), 'utf8')).posts;
const ANSWER_ONLY = POSTS.filter((p) => !p.askerNamesIt).length;

// How students label a post the paper counted for a command.
export const LABELS = [
  { id: 'stuck', label: 'Stuck on it', short: 'Stuck', hint: 'They ask about this command.' },
  { id: 'needs', label: 'Needs it, can’t name it', short: 'Needs it', hint: 'It would solve their problem; they don’t know it.' },
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
    where: 'RQ2 answer, §3.2',
    look: 'How did they measure experience? (§2.1 Step 4; §5)',
    measured: 'Years since the asker registered on Stack Overflow (§5 calls it a proxy), and two quoted askers ([37], [41]).',
    supports: 'As written, it holds: some long-registered askers, including the two quoted, had trouble.',
    why: 'It survives because “can have trouble” is a weak claim. It cannot say how common trouble is, or separate Git experience from programming experience: experienced programmers can be new to Git, as in Paper 1’s Microsoft teams switching from Source Depot and Team Foundation Server.',
  },
  {
    id: 'difficulty', quote: '…for the more frequently-used commands, git credential and git submodule are among the most difficult ones.',
    where: '§1, finding (4); RQ4, §3.4',
    look: 'How does a post get counted for a command? Our re-run: 36.5% of all 80,370 Git questions have no accepted answer.',
    measured: 'The share of a command’s questions where the asker never marked an answer as accepted.',
    supports: 'git credential’s questions lack an accepted answer more often than Git questions overall (paper: 43.0%; our re-run: 39.3% vs 36.5%). git submodule’s barely differ (37.5%).',
    why: 'An accepted answer is one click by the asker, and §5 notes askers may forget it. A post counted through its accepted answer has one by construction, so commands that appear in fixes look easy: git reflog lacks one in 20.7% of its posts, but in 46.3% of the posts whose asker names it (our re-run).',
  },
  {
    id: 'learning', quote: 'Self-learning is the primary learning approach.', where: 'Abstract; RQ5, §3.5',
    look: 'Who was invited, and how? (§2.2, Table 7)',
    measured: 'What 92 of 508 invited people ticked. The practitioners invited had recently asked a Git question on Stack Overflow.',
    supports: 'Most of these 92 say they learned from the internet (85) and the documentation (76).',
    why: 'Most respondents were found through Stack Overflow, which favours internet learners, although all 18 academics ticked the internet too. And “how I learned” is a memory, shaped by the options offered.',
  },
  {
    id: 'selfrating', quote: 'This result, although surprising, is consistent with the conclusion we obtained in RQ2, indicating that even experienced developers still have doubts about Git usage.',
    where: '§3.5',
    look: 'What is the evidence for “doubts”? (§3.5, Fig. 4)',
    measured: 'A self-rated level on a five-step scale, novice to expert, from 92 respondents.',
    supports: 'Most of these 92, many with more than five years of Git, rate themselves competent or below (79 of 92).',
    why: 'A self-rating is a judgment: modesty, the labels offered and what “expert” means all move it. It measures neither doubts nor skill. Sarah: be nervous about Likert scales and introspection.',
  },
];

export const CLAIM_FIELDS = [
  { id: 'measured', label: 'What they measured', placeholder: 'The number behind the claim' },
  { id: 'supports', label: 'What the data supports', placeholder: 'The strongest sentence you would sign' },
];

export const DESIGN_FIELDS = [
  { id: 'change', label: 'One change to Git', placeholder: 'What the user sees or types' },
  { id: 'rq', label: 'The study', placeholder: 'Does … increase/decrease … for … doing …?' },
  { id: 'measure', label: 'Measure, and one threat', placeholder: 'e.g. time to recover; threat: a learning effect' },
  { id: 'data', label: 'Your data', placeholder: 'Watch people, collect traces, or ask them? Which, exactly?' },
];

const KIND = [
  'Need-finding: what problems do people have?',
  'Formative: which solution looks promising?',
  'Evaluative: did our tool work?',
];
const DATA = [
  'Observation: someone watched people use Git',
  'Traces: records people left while working',
  'Self-report: people describing their own experience',
];

// kind: join · survey · slide · vote · reveal · label · code · group · break · exit · end
// shows: what a reveal adds from the class (votes of a scene, survey, labels, codes, group answers, exit lines).
export const SCENES = [
  {
    id: 'join', kind: 'join', part: 'Thursday', title: 'The Humans', minutes: 3,
    lines: ['Open the link and type your first name.'],
    say: 'Tuesday we ran real Git. Today we judge a study of people asking about Git, then design with what survives. You leave with one new idea about tools for people.',
  },
  {
    id: 'survey', kind: 'survey', part: 'Be the data', title: 'Take the paper’s survey', minutes: 4,
    lines: ['The real questions, from the authors’ published form.', '92 developers answered them. You are next.'],
    say: 'Answer for yourself. The projector shows totals only. We will compare you with the paper’s 92.',
  },
  {
    id: 'paper', kind: 'slide', part: '1 · The question', title: 'The paper in one slide', minutes: 2,
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
    say: 'Vote on your laptop. Sarah’s three kinds of study.',
  },
  {
    id: 'kind-reveal', kind: 'reveal', part: '1 · The question', title: 'Need-finding', minutes: 2, shows: 'kind', correct: 0,
    lines: [
      'Its shape: what problems do developers face when using Git commands?',
      'A need-finding study must see what goes badly **and** what goes well. Stack Overflow questions record what people got stuck on; when Git just worked, nobody asked.',
    ],
    ask: 'Is the question interesting?',
    hope: 'Yes, if it tells tool designers which needs to design for. A ranking of command names alone does not.',
    say: 'Need-finding, which Sarah also calls reconnaissance. Ask whether the question is interesting before judging the method.',
  },
  {
    id: 'data', kind: 'vote', part: '2 · The data', title: 'Stack Overflow posts are…', minutes: 2,
    options: DATA,
    say: 'Vote on your laptop.',
  },
  {
    id: 'data-reveal', kind: 'reveal', part: '2 · The data', title: 'Traces. Of asking.', minutes: 2, shows: 'data', correct: 1,
    lines: [
      'Sarah’s ladder: watching beats traces, traces beat asking. Stack Overflow questions are on her list of traces.',
      'Traces of asking, not of using. A question body is also partly self-report: the asker describes the problem.',
      'RQ5 is a survey. Nobody in this paper was watched using Git.',
    ],
    ask: 'Can this data answer “do developers know how to use Git commands?”',
    hope: 'No. It shows what people asked about, not what they can do.',
    say: 'Accept “self-report” as a good argument: say why it is still a trace. Recruiting note (footnote 7): the authors found emails through GitHub accounts, say they were unaware that GitHub’s policy discourages emailing users this way, and recommend others not follow the practice.',
  },
  {
    id: 'survey-reveal', kind: 'reveal', part: '2 · The data', title: 'You and the paper’s 92', minutes: 3, shows: 'survey',
    lines: [
      '81.7% is 161 of 197 ticked boxes. By people: 85 of 92 ticked the internet.',
      'Invited: developers who had recently asked a Git question on Stack Overflow, plus some researchers. 92 of 508 answered.',
    ],
    ask: 'Your level, and how you learned: which would you trust?',
    hope: 'Neither fully. A level is a self-rated judgment on a scale; “how I learned” is a memory shaped by the options. And most of the 92 were found through Stack Overflow, which favours internet learners.',
    say: 'Sarah: we could learn false things. Questions shape responses, and people have no durable, reliable memory of facts. Be nervous about Likert-style self-ratings.',
  },
  {
    id: 'label', kind: 'label', part: '3 · The analysis', title: `Check the rule on ${POSTS.length} real posts`, minutes: 8,
    lines: [
      'The paper’s rule: a post counts for every Git command in its question **or its accepted answer**.',
      'For each post: is the asker stuck on that command, do they need it without knowing its name, or is it not about it?',
    ],
    say: 'Eight posts, drawn at random from short, answered posts that the paper credits to its top-5 commands. Read the question first, then the answer.',
  },
  {
    id: 'label-reveal', kind: 'reveal', part: '3 · The analysis', title: 'The rule and you', minutes: 4, shows: 'labels',
    lines: [
      `The rule counts all ${POSTS.length} posts the same. In ${ANSWER_ONLY}, only the accepted answer names the command.`,
      '“Stuck on it” is evidence a command is confusing. “Needs it, can’t name it” supports the paper’s own idea of recommending commands (§4.1).',
      'Our re-run: one question with 9.1 million views names no command and counts for five. Without it, `git reflog` falls from #2 to #8.',
    ],
    ask: 'Did they measure “developers find this command hard”?',
    hope: 'They measured “this command appears near a question”. That mixes three things your labels separate.',
    say: 'The 9.1M-view question is “How do I undo the most recent local commits in Git?”. Dropping each command’s top two posts, revert, stash, clean and reset stay in the top 5 and reflog falls to #7 (our re-run): undo questions really are heavily viewed; reflog’s place rests on one post. Sarah: have they operationalized their measure well?',
  },
  {
    id: 'code', kind: 'code', part: '3 · The analysis', title: 'Code the comments yourself', minutes: 5,
    lines: [
      'The paper’s Table 8: seven survey comments, each placed in one of six categories.',
      'Put each comment where you would. Then we compare with the paper, and with each other.',
    ],
    say: 'This is qualitative coding: the step the paper does not describe. Work alone, quickly.',
  },
  {
    id: 'code-reveal', kind: 'reveal', part: '3 · The analysis', title: 'Coding without a method', minutes: 3, shows: 'codes',
    lines: [
      'The paper sorted 65 comments into 6 categories “for better delivery purposes”. It names no method and reports no second coder or agreement.',
      'It did measure agreement elsewhere: Cohen’s kappa 0.844 for which posts are about Git commands (§2.1).',
    ],
    ask: 'What would make Table 8 trustworthy?',
    hope: 'A named method (for example thematic analysis), a codebook, two independent coders and their agreement.',
    say: 'Sarah: vibes are not an answer. Did they say what approach they used? Read out the comment you disagreed on most.',
  },
  {
    id: 'break', kind: 'break', part: 'Break', title: 'Break', minutes: 5,
    lines: ['5 minutes. Then groups.'],
    say: 'Before you press Next: everyone opens the /thu tab again, and “here” on your console matches the room. Groups form when you press Next.',
  },
  {
    id: 'claims', kind: 'group', part: '4 · Do you believe it?', title: 'Put one claim on trial', minutes: 7, fields: 'claim',
    lines: ['Your group gets one of the paper’s claims. One person types.', 'Write what they measured, then the strongest sentence the data supports.'],
    say: 'One claim per group. The paper is open on your laptops; the hint points to the section.',
  },
  {
    id: 'claims-reveal', kind: 'reveal', part: '4 · Do you believe it?', title: 'The verdicts', minutes: 5, shows: 'claims',
    lines: ['The title asks whether developers know how to use Git commands. Nothing in the paper watches anyone use one.'],
    ask: 'Which claim survives best, and why?',
    hope: 'The experience claim survives as written, because it is weak. The other three shrink to what was measured.',
    say: 'Read each group’s sentence, then the model answer under it. Students see the reasons on their laptops.',
  },
  {
    id: 'design', kind: 'group', part: '5 · Design', title: 'Design for the need that survived', minutes: 9, fields: 'design',
    lines: [
      'The need: undo. The most-viewed Git question asks how to undo the most recent local commits. Its accepted answer’s fix is `git reset HEAD~`; its further reading points to `git reflog`.',
      'Why do people have to ask? Design one change, and the study that would show it works.',
    ],
    say: 'Asking data is fine for finding a need; whether a fix works needs an evaluative study. Sarah’s shape: does ⟨tool⟩ increase or decrease ⟨measure⟩ for ⟨audience⟩ doing ⟨task⟩? Tuesday’s Safety diary was the reflog on screen.',
  },
  {
    id: 'design-reveal', kind: 'reveal', part: '5 · Design', title: 'Your designs', minutes: 3, shows: 'design',
    ask: 'Which of these could you test by watching people? Which threat is hardest?',
    hope: 'The ones with a measure you can see: time to recover, recoveries that succeed. A learning effect, if the same people try both versions.',
    say: 'One group at a time: the change, the study, the measure, the data.',
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
    id: 'verdict', kind: 'slide', part: 'Thursday', title: 'The paper: what holds, what doesn’t', minutes: 2,
    columns: [
      { title: 'Holds', items: [
        'Git questions are many, and steady: about 0.4% of Stack Overflow a year.',
        'Undo is a real need: the most-viewed Git question asks how to undo a commit.',
        'Experienced developers can have trouble: true, as written.',
        'The data is public, so anyone can check it. We did.',
      ] },
      { title: 'Does not hold, as written', items: [
        '“Hardest commands”: the rule counts fixes in answers as problems.',
        'The command ranking: one post moves `git reflog` from #8 to #2.',
        '“Self-learning is primary”: asked of people found on Stack Overflow.',
        'Table 8 and “doubts”: no coding method; self-ratings, not skill.',
        'The title’s question: nobody was watched using Git.',
      ] },
    ],
    say: 'Fair to the authors: need-finding from public data is useful, and they published it. What breaks is turning counts of asking into claims about difficulty and skill.',
  },
  {
    id: 'exit', kind: 'exit', part: 'Exit', title: 'One new idea for building tools for people', minutes: 2,
    lines: ['One line, on your own.'],
    say: 'Sarah’s bar: nobody leaves without a new insight about designing tools for humans.',
  },
  {
    id: 'end', kind: 'end', part: 'Thursday', title: MESSAGE, minutes: 1, shows: 'exit',
    lines: [
      'Neither the survey (we ask them) nor Stack Overflow (they ask) shows anyone using Git.',
      'Both days: check what your data actually records before you believe it.',
    ],
    say: 'Thank you. Export the answers from Details, then Reset.',
  },
];

export const TOTAL_MINUTES = SCENES.reduce((n, s) => n + s.minutes, 0);
