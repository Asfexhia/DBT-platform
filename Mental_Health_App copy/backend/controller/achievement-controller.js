import User from '../models/userModel.js';
import Achievement, { ACHIEVEMENTS } from '../models/achievementModel.js';
import UserAchievement from '../models/userAchievementModel.js';

// Initialize achievements in database
export const initializeAchievements = async () => {
  try {
    for (const achievementData of ACHIEVEMENTS) {
      await Achievement.findOneAndUpdate(
        { name: achievementData.name },
        achievementData,
        { upsert: true, new: true }
      );
    }
    console.log('Achievements initialized successfully');
  } catch (error) {
    console.error('Error initializing achievements:', error);
  }
};

// Check and unlock achievements for a user
export const checkAndUnlockAchievements = async (userId, triggerType, additionalData = {}) => {
  try {
    const user = await User.findById(userId).populate('achievements');
    if (!user) return [];

    const unlockedAchievements = [];
    const existingAchievements = user.achievements.map(a => a.toString());

    // Get all achievements
    const allAchievements = await Achievement.find({ isActive: true });

    for (const achievement of allAchievements) {
      // Skip if user already has this achievement
      if (existingAchievements.includes(achievement._id.toString())) continue;

      let shouldUnlock = false;

      switch (achievement.condition) {
        case 'first_training':
          shouldUnlock = triggerType === 'training_success' && user.totalTrainingCount === 1;
          break;
        
        case 'ten_trainings':
          shouldUnlock = triggerType === 'training_success' && user.totalTrainingCount >= 10;
          break;
        
        case 'level_2':
          shouldUnlock = triggerType === 'level_up' && user.test_result >= 2;
          break;
        
        case 'level_5':
          shouldUnlock = triggerType === 'level_up' && user.test_result >= 5;
          break;
        
        case 'level_10':
          shouldUnlock = triggerType === 'level_up' && user.test_result >= 10;
          break;
        
        case 'consecutive_7_days':
          shouldUnlock = triggerType === 'login' && user.consecutiveLoginDays >= 7;
          break;
        
        case 'consecutive_15_days':
          shouldUnlock = triggerType === 'login' && user.consecutiveLoginDays >= 15;
          break;
        
        case 'first_test_failure':
          shouldUnlock = triggerType === 'test_failure' && user.testFailureCount === 1;
          break;
        
        case 'five_test_failures':
          shouldUnlock = triggerType === 'test_failure' && user.testFailureCount >= 5;
          break;
      }

      if (shouldUnlock) {
        // Create user achievement record
        await UserAchievement.create({
          user: userId,
          achievement: achievement._id
        });

        // Add achievement to user's achievements array
        user.achievements.push(achievement._id);
        unlockedAchievements.push(achievement);
      }
    }

    if (unlockedAchievements.length > 0) {
      await user.save();
    }

    return unlockedAchievements;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
};

// Update user login streak
export const updateLoginStreak = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    if (lastLogin) {
      lastLogin.setHours(0, 0, 0, 0);
    }

    if (!lastLogin || lastLogin.getTime() !== today.getTime()) {
      // Check if it's consecutive day
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastLogin && lastLogin.getTime() === yesterday.getTime()) {
        // Consecutive day
        user.consecutiveLoginDays += 1;
      } else if (!lastLogin || lastLogin.getTime() < yesterday.getTime()) {
        // Reset streak
        user.consecutiveLoginDays = 1;
      }

      user.lastLoginDate = today;
      await user.save();

      // Check for login-related achievements
      await checkAndUnlockAchievements(userId, 'login');
    }
  } catch (error) {
    console.error('Error updating login streak:', error);
  }
};

// Get user achievements
export const getUserAchievements = async (req, res) => {
  try {
    const { username } = req.params;
    
    // Find user without populate first
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get all achievements
    const allAchievements = await Achievement.find({ isActive: true });
    
    // Get user's unlocked achievements with unlock dates
    const userAchievements = await UserAchievement.find({ user: user._id })
      .populate('achievement');

    const unlockedAchievements = userAchievements.map(ua => ({
      ...ua.achievement.toObject(),
      unlockedAt: ua.unlockedAt
    }));

    const lockedAchievements = allAchievements.filter(achievement => 
      !unlockedAchievements.some(ua => ua._id.toString() === achievement._id.toString())
    );

    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          level: user.test_result,
          experience: user.train_result,
          totalTrainingCount: user.totalTrainingCount,
          consecutiveLoginDays: user.consecutiveLoginDays
        },
        unlockedAchievements,
        lockedAchievements
      }
    });
  } catch (error) {
    console.error('Error getting user achievements:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  initializeAchievements,
  checkAndUnlockAchievements,
  updateLoginStreak,
  getUserAchievements
};