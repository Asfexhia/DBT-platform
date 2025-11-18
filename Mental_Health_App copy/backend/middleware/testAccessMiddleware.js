import User from '../models/userModel.js';

// Middleware to check if user has enough experience to access test page
export const checkTestAccess = async (req, res, next) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username is required',
        hasAccess: false 
      });
    }

    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found',
        hasAccess: false 
      });
    }

    // Check if user has at least 10 successful training sessions (using train_result as experience)
    if (user.train_result < 10) {
      return res.status(403).json({ 
        success: false, 
        message: `需要完成10次成功训练才能解锁测试功能。当前进度: ${user.train_result}/10`,
        hasAccess: false,
        currentProgress: user.train_result,
        requiredProgress: 10
      });
    }

    // User has access, continue to next middleware/route
    req.user = user;
    next();
  } catch (error) {
    console.error('Error checking test access:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      hasAccess: false 
    });
  }
};

// API endpoint to check test access without blocking
export const getTestAccess = async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username is required',
        hasAccess: false 
      });
    }

    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found',
        hasAccess: false 
      });
    }

    const hasAccess = user.train_result >= 10;

    res.json({
      success: true,
      hasAccess,
      currentProgress: user.train_result,
      requiredProgress: 10,
      message: hasAccess 
        ? '已解锁测试功能' 
        : `需要完成${10 - user.train_result}次成功训练才能解锁测试功能`
    });
  } catch (error) {
    console.error('Error getting test access:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      hasAccess: false 
    });
  }
};

export default { checkTestAccess, getTestAccess };