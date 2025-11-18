import mongoose from 'mongoose';

const usageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  username: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['test', 'train', 'quiz'],
    required: true
  },
  bot_id: {
    type: String,
    default: ''
  },
  connector_uid: {
    type: String,
    default: ''
  },
  conversation_id: {
    type: String,
    default: ''
  },
  chat_id: {
    type: String,
    default: ''
  },
  success: {
    type: Boolean,
    default: true
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

const Usage = mongoose.model('Usage', usageSchema);
export default Usage;
