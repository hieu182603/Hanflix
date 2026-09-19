import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Volume2,
  Search,
  Zap,
  Trash2,
  ArrowRight,
  Clock,
  Utensils,
  Plane,
  MessageCircle,
  ShoppingBag,
  Briefcase,
  Film,
  Sparkles,
  CheckCircle2,
  BookmarkPlus,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  VolumeX,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { getPublicVocabulary, type SavedVocabulary, type VocabularyItem } from '../../api/vocabulary';
import TopicFlashcardModal from './TopicFlashcardModal';

export interface VocabularyPageProps {
  savedWords?: SavedVocabulary[];
  onStartReviewSession?: () => void;
  onSaveWord?: (word: { wordId?: string; hanzi: string; pinyin: string; meaningVi: string; partOfSpeech?: string }) => Promise<void>;
  onRemoveWord?: (wordId: string) => void | Promise<void>;
}

export interface WordExample {
  chinese: string;
  pinyin: string;
  vietnamese: string;
}

export interface DisplayWordItem {
  id: string;
  simplified: string;
  pinyin: string;
  meaningVi: string;
  meaningEn?: string;
  partOfSpeech?: string;
  hskLevel: number | string;
  example?: WordExample;
}

export interface TopicConfig {
  id: string;
  nameVi: string;
  nameZh: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
  gradient: string;
  ringColor: string;
  bgImage: string;
  watermarkChar: string;
  wordCountBadge: string;
  hskRange: string;
  sampleWords: DisplayWordItem[];
}

const TOPICS: TopicConfig[] = [
  {
    id: 'food',
    nameVi: 'Ẩm thực Trung Hoa',
    nameZh: '饮食美食',
    description: 'Món ăn Dim sum, đồ uống, đặt bàn tiệc và phong vị ẩm thực các vùng miền',
    icon: Utensils,
    color: '#EA580C',
    bgLight: '#FFF7ED',
    gradient: 'from-orange-500 to-amber-500',
    ringColor: '#F97316',
    bgImage: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '食',
    wordCountBadge: '520+ TỪ',
    hskRange: 'HSK 1-3',
    sampleWords: [
      {
        id: 'food-1',
        simplified: '饺子',
        pinyin: 'jiǎozǐ',
        meaningVi: 'Bánh sủi cảo, bánh chẻo',
        meaningEn: 'Dumplings',
        partOfSpeech: 'Danh từ',
        hskLevel: 2,
        example: {
          chinese: '过年的时候，全家人一起包饺子。',
          pinyin: 'Guònián de shíhòu, quán jiārén yīqǐ bāo jiǎozǐ.',
          vietnamese: 'Dịp Tết đến, cả nhà cùng nhau quây quần gói sủi cảo.',
        },
      },
      {
        id: 'food-2',
        simplified: '点心',
        pinyin: 'diǎnxin',
        meaningVi: 'Điểm tâm, món ăn nhẹ, Dim sum',
        meaningEn: 'Dim sum / Snacks',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '我们去广式茶餐厅吃点心吧。',
          pinyin: 'Wǒmen qù Guǎngshì chá cāntīng chī diǎnxin ba.',
          vietnamese: 'Chúng ta tới quán trà Quảng Đông ăn điểm tâm nhé.',
        },
      },
      {
        id: 'food-3',
        simplified: '烤鸭',
        pinyin: 'kǎoyā',
        meaningVi: 'Vịt quay (Bắc Kinh)',
        meaningEn: 'Roast duck',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '北京烤鸭外脆里嫩，味道非常好。',
          pinyin: 'Běijīng kǎoyā wài cuì lǐ nèn, wèidào fēicháng hǎo.',
          vietnamese: 'Vịt quay Bắc Kinh ngoài giòn trong mềm, hương vị vô cùng ngon.',
        },
      },
      {
        id: 'food-4',
        simplified: '服务员',
        pinyin: 'fúwùyuán',
        meaningVi: 'Người phục vụ, nhân viên bàn',
        meaningEn: 'Waiter / Server',
        partOfSpeech: 'Danh từ',
        hskLevel: 1,
        example: {
          chinese: '服务员，请给我们拿一份菜单。',
          pinyin: 'Fúwùyuán, qǐng gěi wǒmen ná yī fèn càidān.',
          vietnamese: 'Phục vụ ơi, xin hãy cho chúng tôi xem quyển thực đơn.',
        },
      },
      {
        id: 'food-5',
        simplified: '点菜',
        pinyin: 'diǎncài',
        meaningVi: 'Gọi món, chọn món',
        meaningEn: 'Order dishes',
        partOfSpeech: 'Động từ',
        hskLevel: 2,
        example: {
          chinese: '您好，我们已经准备好点菜了。',
          pinyin: 'Nínhǎo, wǒmen yǐjīng zhǔnbèi hǎo diǎncài le.',
          vietnamese: 'Xin chào, chúng tôi đã chuẩn bị sẵn sàng để gọi món rồi.',
        },
      },
      {
        id: 'food-6',
        simplified: '买单',
        pinyin: 'mǎidān',
        meaningVi: 'Thanh toán tiền, tính tiền',
        meaningEn: 'Pay the bill',
        partOfSpeech: 'Động từ',
        hskLevel: 2,
        example: {
          chinese: '请问可以扫微信买单吗？',
          pinyin: 'Qǐngwèn kěyǐ sǎo Wēixìn mǎidān ma?',
          vietnamese: 'Xin hỏi có thể quét WeChat để thanh toán hóa đơn không?',
        },
      },
      {
        id: 'food-7',
        simplified: '酸辣汤',
        pinyin: 'suānlàtāng',
        meaningVi: 'Canh chua cay',
        meaningEn: 'Hot and sour soup',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '冬天的晚上喝一碗酸辣汤特别舒服。',
          pinyin: 'Dōngtiān de wǎnshàng hē yī wǎn suānlàtāng tèbié shūfu.',
          vietnamese: 'Tối mùa đông húp một bát canh chua cay thật là khoan khoái.',
        },
      },
      {
        id: 'food-8',
        simplified: '微辣',
        pinyin: 'wēilà',
        meaningVi: 'Cay nhẹ, cay vừa',
        meaningEn: 'Mild spicy',
        partOfSpeech: 'Tính từ',
        hskLevel: 2,
        example: {
          chinese: '我不太能吃辣，请做微辣的。',
          pinyin: 'Wǒ bù tài néng chī là, qǐng zuò wēilà de.',
          vietnamese: 'Tôi không ăn được cay nhiều, xin hãy làm cay nhẹ thôi nhé.',
        },
      },
      {
        id: 'food-9',
        simplified: '米饭',
        pinyin: 'mǐfàn',
        meaningVi: 'Cơm trắng',
        meaningEn: 'Steamed rice',
        partOfSpeech: 'Danh từ',
        hskLevel: 1,
        example: {
          chinese: '服务员，请再加两碗米饭。',
          pinyin: 'Fúwùyuán, qǐng zài jiā liǎng wǎn mǐfàn.',
          vietnamese: 'Phục vụ ơi, vui lòng cho thêm hai bát cơm trắng nữa nhé.',
        },
      },
      {
        id: 'food-10',
        simplified: '火锅',
        pinyin: 'huǒguō',
        meaningVi: 'Lẩu Trung Hoa',
        meaningEn: 'Hotpot',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '周末大家聚在一起吃四川麻辣火锅。',
          pinyin: 'Zhōumò dàjiā jù zài yīqǐ chī Sìchuān málà huǒguō.',
          vietnamese: 'Cuối tuần mọi người tụ họp cùng ăn lẩu cay Tứ Xuyên.',
        },
      },
      {
        id: 'food-11',
        simplified: '绿茶',
        pinyin: 'lǜchá',
        meaningVi: 'Trà xanh',
        meaningEn: 'Green tea',
        partOfSpeech: 'Danh từ',
        hskLevel: 2,
        example: {
          chinese: '饭后喝一杯热绿茶有助于消化。',
          pinyin: 'Fànhòu hē yī bēi rè lǜchá yǒuzhù yú xiāohuà.',
          vietnamese: 'Sau bữa ăn uống một tách trà xanh nóng rất tốt cho tiêu hóa.',
        },
      },
      {
        id: 'food-12',
        simplified: '筷子',
        pinyin: 'kuàizi',
        meaningVi: 'Đôi đũa',
        meaningEn: 'Chopsticks',
        partOfSpeech: 'Danh từ',
        hskLevel: 2,
        example: {
          chinese: '你会用筷子吃面条吗？',
          pinyin: 'Nǐ huì yòng kuàizi chī miàntiáo ma?',
          vietnamese: 'Bạn có biết dùng đũa để ăn mì không?',
        },
      },
    ],
  },
  {
    id: 'travel',
    nameVi: 'Du lịch & Khám phá',
    nameZh: '旅游出行',
    description: 'Vạn Lý Trường Thành, sân bay, ga tàu cao tốc, khách sạn và hỏi đường',
    icon: Plane,
    color: '#2563EB',
    bgLight: '#EFF6FF',
    gradient: 'from-blue-500 to-cyan-500',
    ringColor: '#38BDF8',
    bgImage: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '旅',
    wordCountBadge: '450+ TỪ',
    hskRange: 'HSK 2-4',
    sampleWords: [
      {
        id: 'travel-1',
        simplified: '高铁',
        pinyin: 'gāotiě',
        meaningVi: 'Tàu cao tốc đường sắt',
        meaningEn: 'High-speed rail',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '从北京坐高铁到上海只需要四个多小时。',
          pinyin: 'Cóng Běijīng zuò gāotiě dào Shànghǎi zhǐ xūyào sì gè duō xiǎoshí.',
          vietnamese: 'Đi tàu cao tốc từ Bắc Kinh tới Thượng Hải chỉ mất hơn bốn tiếng.',
        },
      },
      {
        id: 'travel-2',
        simplified: '机场',
        pinyin: 'jīchǎng',
        meaningVi: 'Sân bay, phi trường',
        meaningEn: 'Airport',
        partOfSpeech: 'Danh từ',
        hskLevel: 2,
        example: {
          chinese: '请问到大兴国际机场在哪里乘地铁？',
          pinyin: 'Qǐngwèn dào Dàxīng Guójì Jīchǎng zài nǎlǐ chéng dìtiě?',
          vietnamese: 'Xin hỏi muốn đi tới sân bay quốc tế Đại Hưng thì đón tàu điện ngầm ở đâu?',
        },
      },
      {
        id: 'travel-3',
        simplified: '行李',
        pinyin: 'xíngli',
        meaningVi: 'Hành lý mang theo',
        meaningEn: 'Luggage / Baggage',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '我的行李箱超重了吗？',
          pinyin: 'Wǒ de xínglixiāng chāozhòng le ma?',
          vietnamese: 'Va ly hành lý của tôi có bị quá cước cân nặng không?',
        },
      },
      {
        id: 'travel-4',
        simplified: '预订',
        pinyin: 'yùdìng',
        meaningVi: 'Đặt trước (phòng, vé)',
        meaningEn: 'Book / Reserve',
        partOfSpeech: 'Động từ',
        hskLevel: 3,
        example: {
          chinese: '我已经在网上预订了三晚酒店。',
          pinyin: 'Wǒ yǐjīng zài wǎngshàng yùdìng le sān wǎn jiǔdiàn.',
          vietnamese: 'Tôi đã đặt trước ba đêm khách sạn qua mạng rồi.',
        },
      },
      {
        id: 'travel-5',
        simplified: '护照',
        pinyin: 'hùzhào',
        meaningVi: 'Hộ chiếu xuất nhập cảnh',
        meaningEn: 'Passport',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '过海关时请出示您的护照和签证。',
          pinyin: 'Guò hǎiguān shí qǐng chūshì nín de hùzhào hé qiānzhèng.',
          vietnamese: 'Khi qua cửa khẩu hải quan xin hãy xuất trình hộ chiếu và thị thực của bạn.',
        },
      },
      {
        id: 'travel-6',
        simplified: '打车',
        pinyin: 'dǎchē',
        meaningVi: 'Bắt taxi, gọi xe công nghệ',
        meaningEn: 'Hail a cab / Take taxi',
        partOfSpeech: 'Động từ',
        hskLevel: 2,
        example: {
          chinese: '下雨了，我们用滴滴打车去酒店吧。',
          pinyin: 'Xiàyǔ le, wǒmen yòng Dīdī dǎchē qù jiǔdiàn ba.',
          vietnamese: 'Trời mưa rồi, chúng ta dùng app Didi gọi xe về khách sạn nhé.',
        },
      },
    ],
  },
  {
    id: 'daily',
    nameVi: 'Cuộc sống Hàng ngày',
    nameZh: '日常交流',
    description: 'Chào hỏi, bạn bè, gia đình, thời tiết và thói quen sinh hoạt thường nhật',
    icon: MessageCircle,
    color: '#16A34A',
    bgLight: '#F0FDF4',
    gradient: 'from-green-500 to-emerald-500',
    ringColor: '#4ADE80',
    bgImage: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '活',
    wordCountBadge: '600+ TỪ',
    hskRange: 'HSK 1-2',
    sampleWords: [
      {
        id: 'daily-1',
        simplified: '朋友',
        pinyin: 'péngyou',
        meaningVi: 'Bạn bè, tri kỷ',
        meaningEn: 'Friend',
        partOfSpeech: 'Danh từ',
        hskLevel: 1,
        example: {
          chinese: '他是我们在北京留学时认识的好朋友。',
          pinyin: 'Tā shì wǒmen zài Běijīng liúxué shí rènshi de hǎo péngyou.',
          vietnamese: 'Cậu ấy là người bạn tốt chúng tôi quen thời còn du học ở Bắc Kinh.',
        },
      },
      {
        id: 'daily-2',
        simplified: '聊天',
        pinyin: 'liáotiān',
        meaningVi: 'Tán gẫu, trò chuyện',
        meaningEn: 'Chat / Converse',
        partOfSpeech: 'Động từ',
        hskLevel: 2,
        example: {
          chinese: '下班后和同事在咖啡厅聊天很放松。',
          pinyin: 'Xiàbān hòu hé tóngshì zài kāfēitīng liáotiān hěn fàngsōng.',
          vietnamese: 'Tan làm ngồi ở quán cà phê trò chuyện với đồng nghiệp thật thư giãn.',
        },
      },
      {
        id: 'daily-3',
        simplified: '天气',
        pinyin: 'tiānqì',
        meaningVi: 'Thời tiết, khí hậu',
        meaningEn: 'Weather',
        partOfSpeech: 'Danh từ',
        hskLevel: 1,
        example: {
          chinese: '今天天气晴朗，非常适合出去散步。',
          pinyin: 'Jīntiān tiānqì qínglǎng, fēicháng shìhé chūqù sànbù.',
          vietnamese: 'Hôm nay thời tiết nắng ráo, rất thích hợp để ra ngoài đi dạo.',
        },
      },
      {
        id: 'daily-4',
        simplified: '起床',
        pinyin: 'qǐchuáng',
        meaningVi: 'Thức dậy, rời giường',
        meaningEn: 'Get out of bed',
        partOfSpeech: 'Động từ',
        hskLevel: 2,
        example: {
          chinese: '我习惯每天早上六点半起床晨跑。',
          pinyin: 'Wǒ xíguàn měitiān zǎoshang liù diǎn bàn qǐchuáng chénpǎo.',
          vietnamese: 'Tôi quen thức dậy lúc sáu giờ rưỡi mỗi sáng để chạy bộ.',
        },
      },
      {
        id: 'daily-5',
        simplified: '周末',
        pinyin: 'zhōumò',
        meaningVi: 'Cuối tuần (thứ 7 & chủ nhật)',
        meaningEn: 'Weekend',
        partOfSpeech: 'Danh từ',
        hskLevel: 2,
        example: {
          chinese: '这个周末你有什么特别的安排吗？',
          pinyin: 'Zhège zhōumò nǐ yǒu shénme tèbié de ānpái ma?',
          vietnamese: 'Cuối tuần này bạn đã có kế hoạch gì đặc biệt chưa?',
        },
      },
    ],
  },
  {
    id: 'business',
    nameVi: 'Kinh doanh & Đàm phán',
    nameZh: '职场商务',
    description: 'Họp đối tác, ký kết hợp đồng thương mại, phỏng vấn và gửi email công sở',
    icon: Briefcase,
    color: '#7C3AED',
    bgLight: '#F5F3FF',
    gradient: 'from-purple-500 to-violet-500',
    ringColor: '#A855F7',
    bgImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '企',
    wordCountBadge: '380+ TỪ',
    hskRange: 'HSK 4-6',
    sampleWords: [
      {
        id: 'biz-1',
        simplified: '合同',
        pinyin: 'hétong',
        meaningVi: 'Hợp đồng thương mại',
        meaningEn: 'Contract / Agreement',
        partOfSpeech: 'Danh từ',
        hskLevel: 4,
        example: {
          chinese: '双方代表已经正式签署了战略合作合同。',
          pinyin: 'Shuāngfāng dàibiǎo yǐjīng zhèngshì qiānshǔ le zhànlüè hézuò hétong.',
          vietnamese: 'Đại diện hai bên đã chính thức ký kết hợp đồng hợp tác chiến lược.',
        },
      },
      {
        id: 'biz-2',
        simplified: '谈判',
        pinyin: 'tánpàn',
        meaningVi: 'Đàm phán, thương lượng',
        meaningEn: 'Negotiate',
        partOfSpeech: 'Động từ',
        hskLevel: 5,
        example: {
          chinese: '这场商务谈判关系到两家公司的未来发展。',
          pinyin: 'Zhè chǎng shāngwù tánpàn guānxì dào liǎng jiā gōngsī de wèilái fāzhǎn.',
          vietnamese: 'Cuộc đàm phán kinh doanh này liên quan mật thiết tới tương lai của cả hai công ty.',
        },
      },
      {
        id: 'biz-3',
        simplified: '投资',
        pinyin: 'tóuzī',
        meaningVi: 'Đầu tư vốn, rót vốn',
        meaningEn: 'Invest / Investment',
        partOfSpeech: 'Động từ / Danh từ',
        hskLevel: 4,
        example: {
          chinese: '该基金决定在人工智能领域投资五千万美元。',
          pinyin: 'Gāi jījīn juédìng zài réngōng zhìnéng lǐngyù tóuzī wǔqiān wàn měiyuán.',
          vietnamese: 'Quỹ đã quyết định rót vốn đầu tư năm mươi triệu đô la vào lĩnh vực trí tuệ nhân tạo.',
        },
      },
      {
        id: 'biz-4',
        simplified: '汇报',
        pinyin: 'huìbào',
        meaningVi: 'Báo cáo công việc với cấp trên',
        meaningEn: 'Report to supervisor',
        partOfSpeech: 'Động từ',
        hskLevel: 4,
        example: {
          chinese: '明天上午向总经理汇报季度营销成果。',
          pinyin: 'Míngtiān shàngwǔ xiàng zǒngjīnglǐ huìbào jìdù yíngxiāo chéngguǒ.',
          vietnamese: 'Sáng mai tôi sẽ báo cáo kết quả tiếp thị quý vừa qua với Tổng Giám đốc.',
        },
      },
    ],
  },
  {
    id: 'shopping',
    nameVi: 'Mua sắm & Tiêu dùng',
    nameZh: '购物消费',
    description: 'Hỏi giá, mặc cả, quét mã WeChat Pay/Alipay và sắm sửa trung tâm thương mại',
    icon: ShoppingBag,
    color: '#D97706',
    bgLight: '#FFFBEB',
    gradient: 'from-amber-500 to-yellow-500',
    ringColor: '#FBBF24',
    bgImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '购',
    wordCountBadge: '410+ TỪ',
    hskRange: 'HSK 3-5',
    sampleWords: [
      {
        id: 'shop-1',
        simplified: '打折',
        pinyin: 'dǎzhé',
        meaningVi: 'Giảm giá, chiết khấu',
        meaningEn: 'Give discount',
        partOfSpeech: 'Động từ',
        hskLevel: 3,
        example: {
          chinese: '商场双十一大促销，全场商品打八折。',
          pinyin: 'Shāngchǎng Shuāng Shíyī dà cùxiāo, quánchǎng shāngpǐn dǎ bā zhé.',
          vietnamese: 'Trung tâm mua sắm ngày lễ 11/11 đại giảm giá, toàn bộ sản phẩm hạ giá 20%.',
        },
      },
      {
        id: 'shop-2',
        simplified: '扫码',
        pinyin: 'sǎomǎ',
        meaningVi: 'Quét mã QR thanh toán',
        meaningEn: 'Scan QR code',
        partOfSpeech: 'Động từ',
        hskLevel: 3,
        example: {
          chinese: '请问您微信扫码还是支付宝付款？',
          pinyin: 'Qǐngwèn nín Wēixìn sǎomǎ háishì Zhīfùbǎo fùkuǎn?',
          vietnamese: 'Xin hỏi quý khách quét mã WeChat hay là thanh toán bằng Alipay ạ?',
        },
      },
      {
        id: 'shop-3',
        simplified: '试穿',
        pinyin: 'shìchuān',
        meaningVi: 'Mặc thử (quần áo, giày dép)',
        meaningEn: 'Try on clothes',
        partOfSpeech: 'Động từ',
        hskLevel: 3,
        example: {
          chinese: '这件外套非常合身，我可以试穿一下吗？',
          pinyin: 'Zhè jiàn wàitào fēicháng héshēn, wǒ kěyǐ shìchuān yīxià ma?',
          vietnamese: 'Chiếc áo khoác này trông rất vừa vặn, tôi có thể mặc thử một chút được không?',
        },
      },
      {
        id: 'shop-4',
        simplified: '退货',
        pinyin: 'tuìhuò',
        meaningVi: 'Trả hàng, hoàn lại đồ',
        meaningEn: 'Return merchandise',
        partOfSpeech: 'Động từ',
        hskLevel: 4,
        example: {
          chinese: '收到商品后七天之内支持无理由退货。',
          pinyin: 'Shōudào shāngpǐn hòu qī tiān zhīnèi zhīchí wú lǐyóu tuìhuò.',
          vietnamese: 'Sau khi nhận hàng trong vòng bảy ngày được hỗ trợ đổi trả không cần lý do.',
        },
      },
    ],
  },
  {
    id: 'entertainment',
    nameVi: 'Văn hóa & Điện ảnh',
    nameZh: '影视娱乐',
    description: 'Xem phim HanFlix, âm nhạc C-Pop, lễ hội truyền thống và giải trí điện ảnh',
    icon: Film,
    color: '#B91B1C',
    bgLight: '#FDF1F1',
    gradient: 'from-red-600 to-rose-500',
    ringColor: '#F43F5E',
    bgImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    watermarkChar: '影',
    wordCountBadge: '500+ TỪ',
    hskRange: 'HSK 2-5',
    sampleWords: [
      {
        id: 'ent-1',
        simplified: '电影',
        pinyin: 'diànyǐng',
        meaningVi: 'Phim điện ảnh, tác phẩm chiếu rạp',
        meaningEn: 'Movie / Film',
        partOfSpeech: 'Danh từ',
        hskLevel: 1,
        example: {
          chinese: '周末我们一起去看最新上映的科幻电影吧。',
          pinyin: 'Zhōumò wǒmen yīqǐ qù kàn zuìxīn shàngyìng de kēhuàn diànyǐng ba.',
          vietnamese: 'Cuối tuần chúng mình cùng nhau đi xem bộ phim khoa học viễn tưởng mới ra rạp nhé.',
        },
      },
      {
        id: 'ent-2',
        simplified: '字幕',
        pinyin: 'zìmù',
        meaningVi: 'Phụ đề phim ảnh (song ngữ)',
        meaningEn: 'Subtitles',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '在HanFlix看剧可以随时开启中越双语字幕。',
          pinyin: 'Zài HanFlix kàn jù kěyǐ suíshí kāiqǐ Zhōng-Yuè shuāngyǔ zìmù.',
          vietnamese: 'Xem phim trên HanFlix có thể bật phụ đề song ngữ Trung - Việt bất cứ lúc nào.',
        },
      },
      {
        id: 'ent-3',
        simplified: '演员',
        pinyin: 'yǎnyuán',
        meaningVi: 'Diễn viên, nghệ sĩ biểu diễn',
        meaningEn: 'Actor / Actress',
        partOfSpeech: 'Danh từ',
        hskLevel: 3,
        example: {
          chinese: '这位年轻演员在剧中把角色的心理演得非常生动。',
          pinyin: 'Zhè wèi niánqīng yǎnyuán zài jù zhōng bǎ juésè de xīnlǐ yǎn de fēicháng shēngdòng.',
          vietnamese: 'Người diễn viên trẻ này đã thể hiện tâm lý nhân vật trong phim vô cùng sống động.',
        },
      },
      {
        id: 'ent-4',
        simplified: '精彩',
        pinyin: 'jīngcǎi',
        meaningVi: 'Tuyệt vời, đặc sắc, mãn nhãn',
        meaningEn: 'Brilliant / Splendid',
        partOfSpeech: 'Tính từ',
        hskLevel: 4,
        example: {
          chinese: '这部电视剧的大结局剧情非常精彩。',
          pinyin: 'Zhè bù diànshìjù de dà jiéjú jùqíng fēicháng jīngcǎi.',
          vietnamese: 'Tập cuối của bộ phim truyền hình này tình tiết vô cùng đặc sắc và cuốn hút.',
        },
      },
    ],
  },
];

export default function VocabularyPage({
  savedWords = [],
  onStartReviewSession,
  onSaveWord,
  onRemoveWord,
}: VocabularyPageProps) {
  const [activeTab, setActiveTab] = useState<'topics' | 'notebook'>('topics');
  const [selectedTopic, setSelectedTopic] = useState<TopicConfig | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [hskFilter, setHskFilter] = useState<string>('all');
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Remote data state
  const [apiWords, setApiWords] = useState<VocabularyItem[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [justSavedIds, setJustSavedIds] = useState<Set<string>>(new Set());
  const [savingWordIds, setSavingWordIds] = useState<Set<string>>(new Set());

  // Topic mastery percentages
  const topicStats: Record<string, { total: number; progress: number }> = {
    food: { total: 520, progress: 68 },
    travel: { total: 450, progress: 45 },
    daily: { total: 600, progress: 75 },
    business: { total: 380, progress: 30 },
    shopping: { total: 410, progress: 55 },
    entertainment: { total: 500, progress: 62 },
  };

  // Saved words stats
  const totalSavedCount = savedWords.length;
  const dueCount = savedWords.filter((w) => {
    const dueAtMs = w.nextReviewAt ? new Date(w.nextReviewAt).getTime() : Number.NaN;
    return Number.isFinite(dueAtMs) && dueAtMs < Date.now();
  }).length;
  const masteredCount = savedWords.filter((w) => (w.repetitions ?? 0) >= 3).length;

  // Reset pagination when topic or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTopic, searchQuery, hskFilter]);

  // Fetch words when user clicks a topic
  useEffect(() => {
    if (!selectedTopic) return;

    let isMounted = true;
    setApiLoading(true);

    getPublicVocabulary({
      tag: selectedTopic.id,
      hskLevel: hskFilter !== 'all' ? hskFilter : undefined,
      search: searchQuery || undefined,
      limit: 50,
    })
      .then((res) => {
        if (isMounted && res?.items) {
          setApiWords(res.items);
        }
      })
      .catch(() => {
        if (isMounted) setApiWords([]);
      })
      .finally(() => {
        if (isMounted) setApiLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTopic, hskFilter, searchQuery]);

  // Merge sample words with API words
  const activeWordList: DisplayWordItem[] = useMemo(() => {
    if (!selectedTopic) return [];

    const baseList = [...selectedTopic.sampleWords];

    if (apiWords.length > 0) {
      apiWords.forEach((apiItem) => {
        const alreadyExists = baseList.some(
          (b) => b.simplified === apiItem.simplified
        );
        if (!alreadyExists) {
          const firstEx = apiItem.examples?.[0];
          baseList.push({
            id: apiItem._id,
            simplified: apiItem.simplified,
            pinyin: apiItem.pinyin,
            meaningVi: apiItem.meanings?.vi?.join(', ') || 'Đang cập nhật nghĩa',
            meaningEn: apiItem.meanings?.en?.join(', ') || undefined,
            partOfSpeech: apiItem.partOfSpeech?.[0] || 'Từ vựng',
            hskLevel: apiItem.hskLevel,
            example: firstEx
              ? {
                  chinese: firstEx.chinese,
                  pinyin: firstEx.pinyin || '',
                  vietnamese: firstEx.vietnamese || '',
                }
              : undefined,
          });
        }
      });
    }

    // Apply filter
    return baseList.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.simplified.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.meaningVi.toLowerCase().includes(searchQuery.toLowerCase());

      const matchHsk =
        hskFilter === 'all' || String(item.hskLevel) === String(hskFilter);

      return matchSearch && matchHsk;
    });
  }, [selectedTopic, apiWords, searchQuery, hskFilter]);

  // Pagination calculation
  const totalItems = activeWordList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedWords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeWordList.slice(start, start + itemsPerPage);
  }, [activeWordList, currentPage, itemsPerPage]);

  // Pronounce audio function
  const playPronunciation = (hanzi: string) => {
    setSpeakingWord(hanzi);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(hanzi);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      utterance.onend = () => setSpeakingWord(null);
      utterance.onerror = () => setSpeakingWord(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setSpeakingWord(null), 1000);
    }
  };

  // Toggle save to SRS
  const handleToggleSave = async (word: DisplayWordItem) => {
    const isSaved = isWordSaved(word);
    setSavingWordIds((prev) => new Set(prev).add(word.id));
    try {
      if (isSaved) {
        setJustSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(word.id);
          return next;
        });
        const existing = savedWords.find(
          (sw) => sw.wordId?._id === word.id || sw.wordId?.hanzi === word.simplified || sw._id === word.id
        );
        const idToRemove = existing?.wordId?._id || existing?._id || word.id;
        if (onRemoveWord) {
          await onRemoveWord(idToRemove);
        }
      } else {
        setJustSavedIds((prev) => new Set(prev).add(word.id));
        if (onSaveWord) {
          await onSaveWord({
            wordId: word.id,
            hanzi: word.simplified,
            pinyin: word.pinyin,
            meaningVi: word.meaningVi,
            partOfSpeech: word.partOfSpeech,
          });
        }
      }
    } catch {
      // Revert optimistic state on error
      setJustSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(word.id);
        else next.delete(word.id);
        return next;
      });
    } finally {
      setSavingWordIds((prev) => {
        const next = new Set(prev);
        next.delete(word.id);
        return next;
      });
    }
  };

  const isWordSaved = (word: DisplayWordItem) => {
    return (
      justSavedIds.has(word.id) ||
      savedWords.some(
        (sw) => sw.wordId?._id === word.id || sw.wordId?.hanzi === word.simplified || sw._id === word.id
      )
    );
  };

  // Flashcard practice state for topics
  const [flashcardTopic, setFlashcardTopic] = useState<TopicConfig | null>(null);
  const [flashcardWords, setFlashcardWords] = useState<DisplayWordItem[]>([]);

  const handleOpenTopicFlashcards = (topic: TopicConfig) => {
    setFlashcardTopic(topic);
    if (selectedTopic && selectedTopic.id === topic.id && activeWordList.length > 0) {
      setFlashcardWords(activeWordList);
    } else {
      const words: DisplayWordItem[] = topic.sampleWords.map((w) => ({ ...w }));
      setFlashcardWords(words);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Stats Bar - Redesigned */}
      <div className="relative overflow-hidden rounded-3xl bg-white p-6 md:p-8 border border-[#E7E7EA] shadow-sm">
        {/* Subtle top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B91B1C] via-[#E85D5D] to-[#B91B1C]" />
        
        {/* Subtle decorative shapes */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#B91B1C]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-[#B91B1C]/3 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          {/* Left: Title & Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#B91B1C] to-[#E85D5D] flex items-center justify-center shadow-lg shadow-[#B91B1C]/25">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-[#18181B] tracking-tight">
                  Kho Từ Vựng
                </h1>
                <span className="text-xs text-[#8B9097] font-medium">HSK 3.0 Chuẩn</span>
              </div>
            </div>
            
            <p className="text-sm text-[#5F6368] max-w-xl leading-relaxed">
              Học từ vựng trực quan theo các nhóm bối cảnh đời sống thực tế, kết hợp nghe phát âm chuẩn giọng Bắc Kinh và ôn luyện ngắt quãng (SRS).
            </p>
          </div>

          {/* Right: Stats Grid */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F7F7F9] rounded-2xl p-4 border border-[#E7E7EA] min-w-[100px]">
                <div className="text-[10px] font-bold text-[#8B9097] uppercase tracking-wider mb-1">Tổng kho</div>
                <div className="text-xl font-black text-[#18181B]">12,500+</div>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 min-w-[100px]">
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Làm chủ</div>
                <div className="text-xl font-black text-emerald-600">68%</div>
              </div>
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100 min-w-[100px]">
                <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Cần ôn</div>
                <div className="text-xl font-black text-red-600">{dueCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Selection */}
      <div className="flex items-center justify-between border-b border-[#E7E7EA] pb-1">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveTab('topics');
              setSelectedTopic(null);
            }}
            className={`pb-3 px-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'topics' && !selectedTopic
                ? 'border-[#B91B1C] text-[#B91B1C]'
                : 'border-transparent text-[#5F6368] hover:text-[#18181B]'
            }`}
          >
            <span>🗂️ Các Hộp Chủ Đề (Topic Hub)</span>
          </button>

          {selectedTopic && activeTab === 'topics' && (
            <div className="flex items-center gap-1.5 text-xs font-black text-[#B91B1C] pb-3 px-2 border-b-2 border-[#B91B1C]">
              <span>/</span>
              <span>{selectedTopic.nameVi}</span>
              <span className="text-zinc-400 font-normal">({selectedTopic.nameZh})</span>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: THEMATIC TOPIC BOXES GRID (APPROVED DESIGN 1) */}
      {activeTab === 'topics' && !selectedTopic && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#B91B1C] bg-[#FDF1F1] px-2.5 py-1 rounded-full mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kho Chủ Đề Phong Phú</span>
              </div>
              <h2 className="text-xl font-black text-[#18181B]">
                Chọn Chủ Đề Để Mở Danh Sách Từ Vựng
              </h2>
              <p className="text-xs text-[#5F6368]">
                Bấm vào từng hộp chủ đề để xem chi tiết danh sách từ, câu ví dụ thực tế và nghe phát âm.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TOPICS.map((topic) => {
              const Icon = topic.icon;
              const stats = topicStats[topic.id] || { total: 400, progress: 50 };

              return (
                <div
                  key={topic.id}
                  onClick={() => {
                    setSelectedTopic(topic);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="group relative rounded-3xl overflow-hidden min-h-[260px] p-6 border border-[#2D2E33]/90 hover:border-[#B91B1C] shadow-md hover:shadow-2xl hover:shadow-black/40 transition-all duration-500 cursor-pointer flex flex-col justify-between"
                >
                  {/* Background Image Layer with smooth zoom */}
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ backgroundImage: `url(${topic.bgImage})` }}
                  />

                  {/* Cinematic Gradient Overlay - Reduced opacity for better image visibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0E11]/95 via-[#0D0E11]/50 to-[#0D0E11]/20 group-hover:via-[#0D0E11]/40 transition-colors duration-500" />

                  {/* Ambient Glow */}
                  <div
                    className="absolute -top-20 -right-20 w-44 h-44 rounded-full blur-3xl opacity-0 group-hover:opacity-25 transition-opacity duration-700 pointer-events-none"
                    style={{ backgroundColor: topic.color }}
                  />

                  {/* Calligraphic Chinese Watermark */}
                  <div className="absolute top-2 right-4 text-7xl md:text-8xl font-serif font-black text-white/10 group-hover:text-white/20 select-none pointer-events-none transition-all duration-500 group-hover:scale-105">
                    {topic.watermarkChar}
                  </div>

                  {/* Top Bar: Icon Badge & Circular Progress Ring */}
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"
                      style={{ color: topic.color }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    {/* Mastery Circular Progress */}
                    <div className="relative flex items-center gap-2.5 bg-black/50 backdrop-blur-md py-1.5 px-3 rounded-2xl border border-white/10">
                      <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-white/15"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            stroke={topic.ringColor}
                            strokeDasharray={`${stats.progress}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute text-[10px] font-black text-white font-mono">
                          {stats.progress}%
                        </div>
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-black tracking-wider text-[#A1A1AA] uppercase">
                          Làm chủ
                        </span>
                        <span className="text-[11px] font-bold text-white/90">
                          {stats.progress > 0 ? `${stats.progress}% Hoàn tất` : 'Chưa học'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Area: Titles & Description */}
                  <div className="relative z-10 my-4">
                    <div className="flex items-baseline gap-2.5">
                      <h3 className="text-xl font-black text-white group-hover:text-red-400 transition-colors">
                        {topic.nameVi}
                      </h3>
                      <span className="text-sm font-serif font-black text-amber-300/80 tracking-wide">
                        {topic.nameZh}
                      </span>
                    </div>

                    <p className="text-xs text-[#D4D4D8]/80 mt-2 line-clamp-2 leading-relaxed">
                      {topic.description}
                    </p>
                  </div>

                  {/* Bottom Area: Badges & Sleek Arrow Button */}
                  <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-black/60 border border-white/15 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {topic.hskRange}
                      </span>
                      <span className="bg-[#B91B1C] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{topic.wordCountBadge}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTopicFlashcards(topic);
                        }}
                        className="h-8 px-3 rounded-full bg-white/15 hover:bg-[#B91B1C] border border-white/20 hover:border-[#B91B1C] text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                        title="Luyện flashcard chủ đề này"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Luyện thẻ</span>
                      </button>
                      <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-[#B91B1C] border border-white/15 group-hover:border-[#B91B1C] flex items-center justify-center text-white/90 group-hover:text-white group-hover:scale-105 group-hover:translate-x-1 transition-all duration-300 shadow-md">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: TOPIC DETAIL & SEQUENTIAL WORD LIST WITH PAGINATION (APPROVED DESIGN 2) */}
      {activeTab === 'topics' && selectedTopic && (
        <div className="space-y-6">
          {/* Top Filter & Navigation Header - Redesigned with Design Taste */}
          <div className="space-y-4">
            {/* Topic Hero Card */}
            <div className="bg-white rounded-3xl p-6 md:p-7 border border-[#E7E7EA] shadow-2xs">
              {/* Back Button */}
              <div className="mb-4">
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-[#E7E7EA] bg-[#F7F7F9] hover:bg-white hover:border-[#B91B1C]/40 text-[#18181B] text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#B91B1C]" />
                  <span>Quay lại tất cả chủ đề</span>
                </button>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  {/* Topic Icon Avatar */}
                  <div className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 ${selectedTopic.bgLight} border border-[#E7E7EA] shadow-2xs`}>
                    {React.createElement(selectedTopic.icon, { className: `w-6 h-6 ${selectedTopic.color}` })}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight">
                        {selectedTopic.nameVi}
                      </h1>
                      <span className="text-lg sm:text-xl font-hanzi font-bold text-[#8B9097]">
                        / {selectedTopic.nameZh}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-[#FDF1F1] border border-[#B91B1C]/20 text-xs font-bold text-[#B91B1C] whitespace-nowrap shrink-0">
                        {totalItems} từ vựng
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#5F6368] mt-1.5 max-w-2xl leading-relaxed">
                      {selectedTopic.description || 'Danh sách từ vựng trọng tâm theo bối cảnh thực tế. Bấm vào biểu tượng loa để nghe AI phát âm chuẩn hoặc lưu vào sổ tay SRS để tự động lên lịch ôn tập.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenTopicFlashcards(selectedTopic)}
                    className="h-11 px-5 rounded-2xl bg-[#B91B1C] hover:bg-[#A3181A] text-white text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-md hover:shadow-lg shadow-[#B91B1C]/20 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Luyện Flashcard ({totalItems} từ)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-3.5 md:p-4 border border-[#E7E7EA] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#8B9097] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm từ trong chủ đề (chữ Hán, pinyin, nghĩa)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs font-medium text-[#18181B] placeholder-[#8B9097] outline-none focus:border-[#B91B1C] focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold p-0.5 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* HSK Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                <span className="text-[11px] font-bold text-[#8B9097] uppercase tracking-wider mr-1 hidden lg:inline-block shrink-0">
                  Cấp độ:
                </span>
                {[
                  { label: 'Tất cả', value: 'all' },
                  { label: 'HSK 1', value: '1' },
                  { label: 'HSK 2', value: '2' },
                  { label: 'HSK 3', value: '3' },
                  { label: 'HSK 4', value: '4' },
                  { label: 'HSK 5', value: '5' },
                  { label: 'HSK 6', value: '6' },
                  { label: 'HSK 7-9', value: '7-9' },
                ].map((chip) => (
                  <button
                    key={chip.value}
                    onClick={() => setHskFilter(chip.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      hskFilter === chip.value
                        ? 'bg-[#B91B1C] text-white shadow-xs font-extrabold'
                        : 'bg-[#F7F7F9] text-[#5F6368] hover:text-[#18181B] hover:bg-neutral-200/50 border border-[#E7E7EA]'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sequential Word Cards List */}
          {apiLoading ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#E7E7EA]">
              <div className="w-8 h-8 border-3 border-[#B91B1C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-[#8B9097]">Đang tải danh sách từ vựng...</p>
            </div>
          ) : paginatedWords.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#E7E7EA]">
              <p className="text-sm font-bold text-[#18181B]">Không tìm thấy từ vựng nào</p>
              <p className="text-xs text-[#8B9097] mt-1">
                Thử tìm với từ khóa khác hoặc chọn mức độ HSK khác.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedWords.map((word, index) => {
                const saved = isWordSaved(word);
                const isSpeaking = speakingWord === word.simplified;

                return (
                  <div
                    key={word.id || index}
                    className="group bg-white rounded-2xl p-5 border border-[#E7E7EA] hover:border-[#B91B1C]/50 hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    {/* Left Section: Hanzi, Audio Speaker & Pinyin + Meaning */}
                    <div className="flex items-start md:items-center gap-5 min-w-0 flex-1">
                      {/* Large Hanzi Character */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-3xl sm:text-4xl font-serif font-black text-[#18181B] group-hover:text-[#B91B1C] transition-colors tracking-wide">
                          {word.simplified}
                        </span>

                        {/* Audio Pronunciation Button */}
                        <button
                          onClick={() => playPronunciation(word.simplified)}
                          title="Nghe phát âm chuẩn AI"
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            isSpeaking
                              ? 'bg-[#B91B1C] text-white border-[#B91B1C] scale-105 shadow-sm'
                              : 'border-[#E7E7EA] bg-[#F7F7F9] text-[#5F6368] hover:text-[#B91B1C] hover:border-[#B91B1C]/40 hover:bg-[#FDF1F1]'
                          }`}
                        >
                          <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
                        </button>
                      </div>

                      {/* Pinyin, Meaning & Part of Speech */}
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-mono font-bold text-[#B91B1C]">
                            {word.pinyin}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F7F7F9] text-[#5F6368] border border-[#E7E7EA]">
                            HSK {word.hskLevel}
                          </span>
                          {word.partOfSpeech && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {word.partOfSpeech}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-[#18181B] mt-1 truncate">
                          {word.meaningVi}
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Real-life Example Sentence (if available) */}
                    {word.example && (
                      <div className="flex-1 min-w-0 bg-[#F7F7F9]/80 rounded-xl p-3 border border-[#E7E7EA]/60 text-xs hidden lg:block">
                        <div className="font-serif font-semibold text-[#18181B] text-xs">
                          {word.example.chinese}
                        </div>
                        <div className="font-mono text-[11px] text-[#8B9097] mt-0.5">
                          {word.example.pinyin}
                        </div>
                        <div className="text-[11px] text-[#5F6368] font-medium mt-0.5 line-clamp-1">
                          {word.example.vietnamese}
                        </div>
                      </div>
                    )}

                    {/* Right Section: Save to SRS Button */}
                    <div className="shrink-0 w-full md:w-auto flex justify-end">
                      <button
                        onClick={() => void handleToggleSave(word)}
                        disabled={savingWordIds.has(word.id)}
                        className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          saved
                            ? 'bg-[#E6F4EA] text-[#137333] border border-[#A8DAB5]'
                            : 'bg-white hover:bg-[#FDF1F1] text-[#18181B] hover:text-[#B91B1C] border border-[#E7E7EA]'
                        } ${savingWordIds.has(word.id) ? 'opacity-60 cursor-wait' : ''}`}
                      >
                        {savingWordIds.has(word.id) ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            <span>Đang xử lý...</span>
                          </>
                        ) : saved ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#137333]" />
                            <span>Đã lưu sổ tay</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            <span>Lưu vào sổ tay SRS</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="bg-white rounded-2xl p-4 border border-[#E7E7EA] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
              <div className="text-xs text-[#5F6368] font-bold">
                Trang <span className="text-[#18181B]">{currentPage}</span> / {totalPages}{' '}
                <span className="text-[#8B9097] font-normal">({totalItems} từ vựng)</span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Previous Button */}
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage((prev) => Math.max(1, prev - 1));
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                  className="h-9 px-3 rounded-xl border border-[#E7E7EA] bg-white hover:bg-[#F7F7F9] text-xs font-bold text-[#18181B] flex items-center gap-1 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trang trước</span>
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1 mx-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 7) return true;
                      return (
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1
                      );
                    })
                    .map((page, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;

                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && (
                            <span className="px-1 text-xs text-[#8B9097]">...</span>
                          )}
                          <button
                            onClick={() => {
                              setCurrentPage(page);
                              window.scrollTo({ top: 120, behavior: 'smooth' });
                            }}
                            className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              currentPage === page
                                ? 'bg-[#B91B1C] text-white shadow-xs'
                                : 'bg-white hover:bg-[#F7F7F9] text-[#18181B] border border-[#E7E7EA]'
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                {/* Next Button */}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                  className="h-9 px-3 rounded-xl bg-[#B91B1C] hover:bg-[#A3181A] text-xs font-bold text-white flex items-center gap-1 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-xs"
                >
                  <span>Trang sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MY NOTEBOOK (SỔ TAY SRS ĐÃ LƯU) */}
      {activeTab === 'notebook' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E7E7EA] flex items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 text-[#8B9097] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Tìm từ đã lưu theo chữ Hán hoặc Pinyin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F7F9] border border-[#E7E7EA] rounded-xl text-xs outline-none focus:border-[#B91B1C]"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E7E7EA] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F7F9] border-b border-[#E7E7EA] text-[#8B9097] uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-4">Chữ Hán</th>
                  <th className="p-4">Phiên âm Pinyin</th>
                  <th className="p-4">Trạng thái SRS</th>
                  <th className="p-4">Phát âm AI</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E7EA]">
                {savedWords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#5F6368] text-sm">
                      Chưa có từ vựng nào trong sổ tay. Hãy mở các hộp chủ đề để lưu thêm từ vựng mới!
                    </td>
                  </tr>
                ) : (
                  savedWords.map((word) => (
                    <tr key={word._id} className="hover:bg-[#F7F7F9]/50 transition-colors">
                      <td className="p-4">
                        <div className="font-black text-xl text-[#18181B] leading-tight">
                          {word.wordId?.hanzi || '—'}
                        </div>
                        {word.wordId?.meaningVi && (
                          <div className="text-xs text-[#5F6368] mt-0.5 line-clamp-1">
                            {word.wordId.meaningVi}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="font-mono font-bold text-[#B91B1C]">
                          {word.wordId?.pinyin || '—'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-[#5F6368]">
                            Lặp lại: <span className="font-bold text-[#18181B]">{word.repetitions ?? 0}</span> lần
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-block w-fit ${
                              new Date(word.nextReviewAt).getTime() < Date.now()
                                ? 'bg-red-50 text-[#B91B1C]'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {new Date(word.nextReviewAt).getTime() < Date.now() ? 'Cần ôn tập' : 'Đang ghi nhớ'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => playPronunciation(word.wordId?.hanzi || '')}
                          aria-label={`Phát âm ${word.wordId?.hanzi || ''}`}
                          className={`p-1.5 rounded-full border transition-colors ${
                            speakingWord === word.wordId?.hanzi
                              ? 'bg-[#B91B1C] text-white border-[#B91B1C]'
                              : 'border-[#E7E7EA] text-[#5F6368] hover:text-[#B91B1C]'
                          }`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        {onRemoveWord && (
                          <button
                            onClick={() => onRemoveWord(word.wordId?._id || word._id)}
                            className="p-1.5 rounded-lg border border-[#E7E7EA] hover:bg-[#FDF1F1] text-[#B91B1C] cursor-pointer"
                            title="Bỏ lưu từ vựng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Topic Flashcard Practice Modal */}
      <TopicFlashcardModal
        isOpen={Boolean(flashcardTopic)}
        topic={flashcardTopic}
        words={flashcardWords}
        onClose={() => setFlashcardTopic(null)}
        onToggleSaveWord={handleToggleSave}
        isWordSaved={isWordSaved}
      />
    </div>
  );
}
