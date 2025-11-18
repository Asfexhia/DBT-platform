import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🏆'
  },
  condition: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Achievement = mongoose.model('Achievement', achievementSchema);

// Predefined achievements
export const ACHIEVEMENTS = [
  {
    name: '第一步',
    description: '成功完成第一次训练',
    icon: '🌟',
    condition: 'first_training'
  },
  {
    name: '勤为本',
    description: '累计成功训练十次',
    icon: '📚',
    condition: 'ten_trainings'
  },
  {
    name: '初窥门径',
    description: '达到2级',
    icon: '🎯',
    condition: 'level_2'
  },
  {
    name: '得心应手',
    description: '达到5级',
    icon: '⭐',
    condition: 'level_5'
  },
  {
    name: '多么寂寞',
    description: '达到10级',
    icon: '👑',
    condition: 'level_10'
  },
  {
    name: '锲而不舍',
    description: '连续进行训练7天',
    icon: '🔥',
    condition: 'consecutive_7_days'
  },
  {
    name: '行百里者',
    description: '连续进行训练15天',
    icon: '💎',
    condition: 'consecutive_15_days'
  },
  {
    name: '成功之母',
    description: '在一次测试中失败',
    icon: '💪',
    condition: 'first_test_failure'
  },
  {
    name: '百折不挠',
    description: '测试失败累计5次',
    icon: '🛡️',
    condition: 'five_test_failures'
  }
];

export default Achievement;