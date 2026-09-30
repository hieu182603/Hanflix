import { pinyin } from 'pinyin-pro';
import { hsk3Sample } from './hsk3-exam.js';
import { importExamSchema, type ExamInput, type GradedQuestion } from '../services/exam-validation.js';

type SampleQuestion = Pick<GradedQuestion, 'skill' | 'promptText' | 'correctAnswer' | 'explanationVi'> & Partial<GradedQuestion>;
const sampleQuestions: Record<number, SampleQuestion[]> = {
  1: [
    { skill: 'listening', promptText: '他想喝什么？', dialogue: [{ speaker: '男', text: '我想喝茶。' }], options: ['A. 茶', 'B. 水', 'C. 咖啡'], correctAnswer: 'A', explanationVi: 'Người nói muốn uống trà: 喝茶.' },
    { skill: 'listening', promptText: '她今天去学校。', type: 'true_false', dialogue: [{ speaker: '女', text: '今天我不去学校。' }], correctAnswer: 'False', explanationVi: '不去学校 nghĩa là không đến trường, nên nhận định sai.' },
    { skill: 'reading', promptText: '我家有三个人：爸爸、妈妈和我。我家有几个人？', options: ['A. 两个', 'B. 三个', 'C. 四个'], correctAnswer: 'B', explanationVi: '三个人 là ba người: bố, mẹ và tôi.' },
    { skill: 'reading', promptText: '现在是上午九点。现在是晚上。', type: 'true_false', correctAnswer: 'False', explanationVi: '上午 là buổi sáng, không phải 晚上 (buổi tối).' },
  ],
  2: [
    { skill: 'listening', promptText: '他们几点见面？', dialogue: [{ speaker: '女', text: '我们八点见面，好吗？' }, { speaker: '男', text: '我八点有课，九点吧。' }, { speaker: '女', text: '好。' }], options: ['A. 七点', 'B. 八点', 'C. 九点'], correctAnswer: 'C', explanationVi: 'Hai người thống nhất gặp lúc 九点 (9 giờ), vì 8 giờ người nam có lớp.' },
    { skill: 'listening', promptText: '今天比昨天冷。', type: 'true_false', dialogue: [{ speaker: '女', text: '昨天很冷，今天暖和多了。' }], correctAnswer: 'False', explanationVi: '今天暖和多了 nghĩa là hôm nay ấm hơn nhiều.' },
    { skill: 'reading', promptText: '小王每天坐公共汽车去公司，今天他骑自行车去了。今天小王怎么去公司？', options: ['A. 坐公共汽车', 'B. 骑自行车', 'C. 走路'], correctAnswer: 'B', explanationVi: 'Chú ý 今天: hôm nay đi xe đạp, khác thói quen hằng ngày.' },
    { skill: 'reading', promptText: '这件衣服太贵了，我想买一件便宜一点儿的。他觉得这件衣服不便宜。', type: 'true_false', correctAnswer: 'True', explanationVi: '太贵了 và 不便宜 đều diễn đạt giá đắt.' },
  ],
  4: [
    { skill: 'listening', promptText: '男的为什么迟到了？', dialogue: [{ speaker: '男', text: '真抱歉，路上堵车，让你久等了。' }, { speaker: '女', text: '没关系，我也刚到。' }], options: ['A. 起床太晚', 'B. 交通堵塞', 'C. 忘了时间', 'D. 走错了路'], correctAnswer: 'B', explanationVi: '堵车 là tắc đường, nguyên nhân đến muộn.' },
    { skill: 'listening', promptText: '女的接受了邀请。', type: 'true_false', dialogue: [{ speaker: '男', text: '周末一起去爬山吧。' }, { speaker: '女', text: '谢谢，不过我得在家准备考试。' }], correctAnswer: 'False', explanationVi: '不过 chuyển ý; cô ấy cần ở nhà ôn thi nên từ chối.' },
    { skill: 'reading', promptText: '虽然这份工作很辛苦，但是他从来没有想过放弃，因为他能从中学到很多东西。他为什么坚持这份工作？', options: ['A. 工资很高', 'B. 离家很近', 'C. 能学到东西', 'D. 工作很轻松'], correctAnswer: 'C', explanationVi: 'Mệnh đề sau 因为 nêu lý do: học được nhiều điều.' },
    { skill: 'reading', promptText: '请把会议时间提前一个小时，改到上午九点。原来的会议时间是几点？', options: ['A. 八点', 'B. 九点', 'C. 十点', 'D. 十一点'], correctAnswer: 'C', explanationVi: 'Chuyển sớm một giờ thành 9 giờ, nên giờ ban đầu là 10 giờ.' },
    { skill: 'writing', type: 'sentence_ordering', promptText: 'Sắp xếp các cụm từ thành câu.', sentenceChunks: ['寄出去了', '他', '已经', '把信'], correctAnswer: '他已经把信寄出去了', explanationVi: 'Chủ ngữ + 已经 + 把 + tân ngữ + động từ và bổ ngữ.' },
    { skill: 'writing', type: 'sentence_ordering', promptText: 'Sắp xếp câu dùng 越来越.', sentenceChunks: ['越来越', '变得', '方便了', '网上购物'], correctAnswer: '网上购物变得越来越方便了', explanationVi: '网上购物 làm chủ ngữ; 越来越方便 là ngày càng tiện lợi.' },
  ],
  5: [
    { skill: 'listening', promptText: '男的对这个方案持什么态度？', dialogue: [{ speaker: '女', text: '这个方案能降低成本，你觉得怎么样？' }, { speaker: '男', text: '方向不错，不过实施之前还得考虑员工的意见。' }], options: ['A. 完全反对', 'B. 赞成但需完善', 'C. 毫不关心', 'D. 要立即实施'], correctAnswer: 'B', explanationVi: '方向不错 biểu thị đồng tình, 不过...还得 nêu điều cần bổ sung.' },
    { skill: 'listening', promptText: '这家书店吸引顾客的主要原因是什么？', dialogue: [{ speaker: '女', text: '这家书店的书并不便宜，可是环境安静，还经常组织读书交流活动，所以我总来。' }], options: ['A. 价格低廉', 'B. 交通方便', 'C. 阅读环境和活动', 'D. 营业时间长'], correctAnswer: 'C', explanationVi: 'Môi trường yên tĩnh và hoạt động trao đổi sách là lý do được nêu.' },
    { skill: 'reading', promptText: '城市里的旧厂房不一定只能拆除。保留其建筑特色，改造成图书馆或展览馆，既能延续城市记忆，也能满足居民的文化需求。这段话主要主张什么？', options: ['A. 所有厂房都应拆除', 'B. 合理利用旧建筑', 'C. 减少公共文化空间', 'D. 恢复工厂生产'], correctAnswer: 'B', explanationVi: 'Đoạn văn đề xuất chuyển đổi công năng nhà xưởng cũ để bảo tồn và phục vụ văn hóa.' },
    { skill: 'reading', promptText: '与其等到问题严重时再处理，不如在初期就采取措施。作者强调什么？', options: ['A. 及时预防', 'B. 耐心等待', 'C. 忽略小事', 'D. 延迟决定'], correctAnswer: 'A', explanationVi: '与其...不如... so sánh lựa chọn; tác giả ưu tiên hành động sớm.' },
    { skill: 'writing', type: 'sentence_ordering', promptText: 'Sắp xếp câu nhượng bộ.', sentenceChunks: ['他还是', '尽管', '坚持完成了任务', '遇到了不少困难'], correctAnswer: '尽管遇到了不少困难他还是坚持完成了任务', explanationVi: '尽管...还是... diễn đạt dù gặp khó khăn vẫn kiên trì hoàn thành.' },
    { skill: 'writing', type: 'fill_in_blank', promptText: '这项研究为解决问题提供了新的____。', options: ['思路', '思念', '思想家', '意思'], correctAnswer: '思路', explanationVi: '提供新的思路 là cung cấp hướng suy nghĩ mới; đây là bài luyện từ rút gọn, không phải bài luận HSK 5.' },
  ],
  6: [
    { skill: 'listening', promptText: '说话人认为技术发展应当注意什么？', dialogue: [{ speaker: '讲者', text: '技术创新固然重要，但如果忽视老年人的实际需求，数字化反而可能成为一道门槛。真正的进步应当让每个人都能受益。' }], options: ['A. 只追求速度', 'B. 兼顾不同群体的需求', 'C. 停止数字化', 'D. 提高使用门槛'], correctAnswer: 'B', explanationVi: 'Người nói nhấn mạnh nhu cầu của người cao tuổi và lợi ích cho mọi người.' },
    { skill: 'listening', promptText: '这段话否定了传统经验的全部价值。', type: 'true_false', dialogue: [{ speaker: '讲者', text: '传统经验并非毫无价值，但不能照搬。我们应结合现实条件，有选择地加以借鉴。' }], correctAnswer: 'False', explanationVi: '并非毫无价值 là phủ định kép: kinh nghiệm truyền thống vẫn có giá trị, cần vận dụng có chọn lọc.' },
    { skill: 'reading', promptText: '请选择有语病的一项。', options: ['A. 通过这次讨论，使我明白了合作的重要性。', 'B. 这次讨论让我明白了合作的重要性。', 'C. 我在讨论中认识到了合作的重要性。', 'D. 大家都认为合作十分重要。'], correctAnswer: 'A', explanationVi: '通过...使... khiến câu thiếu chủ ngữ. Có thể bỏ 通过 hoặc 使.' },
    { skill: 'reading', promptText: '请选择有语病的一项。', options: ['A. 能否成功取决于多种因素。', 'B. 我们需要认真分析问题的原因。', 'C. 这次活动提高了同学们的知识。', 'D. 他提出的建议值得进一步讨论。'], correctAnswer: 'C', explanationVi: 'Động từ và tân ngữ không phù hợp: nên dùng 增长知识 hoặc 提高水平.' },
    { skill: 'writing', type: 'sentence_ordering', promptText: 'Bài luyện câu rút gọn (không thay thế bài tóm tắt HSK 6).', sentenceChunks: ['才能', '只有', '作出合理的判断', '充分了解事实'], correctAnswer: '只有充分了解事实才能作出合理的判断', explanationVi: '只有...才... biểu thị điều kiện cần để đưa ra phán đoán hợp lý.' },
    { skill: 'writing', type: 'fill_in_blank', promptText: '面对不同意见，我们应当____沟通，而不是急于否定。', options: ['坦诚地', '偶然地', '盲目地', '勉强地'], correctAnswer: '坦诚地', explanationVi: '坦诚地沟通 là trao đổi thẳng thắn; đây là bài luyện từ, không chấm bài luận tự do.' },
  ],
};

function makeSample(level: number): ExamInput {
  const questions: GradedQuestion[] = (sampleQuestions[level] ?? []).map((q, index) => ({
    ...q, id: `h${level}q${index + 1}`, order: index + 1, part: 1, type: q.type ?? 'single_choice',
    instruction: q.type === 'true_false' ? 'Xác định đúng hoặc sai.' : q.type === 'sentence_ordering' ? 'Sắp xếp các cụm từ.' : 'Chọn đáp án phù hợp nhất.',
    ...(level <= 2 ? {
      pinyinScript: pinyin(q.promptText ?? ''),
      options: q.options?.map(option => `${option} (${pinyin(option.replace(/^[A-Z]\.\s*/, ''))})`),
      dialogue: q.dialogue?.map(line => ({ ...line, pinyin: pinyin(line.text) })),
    } : {}),
  }));
  const skills = level <= 2 ? ['listening', 'reading'] as const : ['listening', 'reading', 'writing'] as const;
  return importExamSchema.parse({
    code: `H${level}1001`, title: `HSK ${level} — Đề mẫu rút gọn`, level, category: 'mini_test',
    durationMinutes: 15, totalQuestions: questions.length, totalScore: skills.length * 100,
    passingScore: level <= 2 ? 120 : 180, isPublished: true,
    description: 'Đề luyện tập do HanFlix biên soạn, không phải đề CTI chính thức. Nghe bằng giọng đọc trình duyệt khi chưa có audio. Viết được chấm theo đáp án cố định, không bao gồm bài luận tự do.',
    sections: skills.map(skill => ({
      skill, title: skill === 'listening' ? 'Nghe hiểu' : skill === 'reading' ? 'Đọc hiểu' : 'Viết',
      totalQuestions: questions.filter(q => q.skill === skill).length, durationMinutes: 5,
      instructions: 'Hoàn thành các câu hỏi trong phần này.', questions: questions.filter(q => q.skill === skill),
    })),
  });
}

export const examSeeds: ExamInput[] = [makeSample(1), makeSample(2), importExamSchema.parse(hsk3Sample), makeSample(4), makeSample(5), makeSample(6)];
