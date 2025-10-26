import React, { useState, useEffect } from 'react';
import Navbar from '../navbar/Navbar';
import './Achievements.css';

const Achievements = () => {
  const [userStats, setUserStats] = useState({
    username: '',
    level: 0,
    experience: 0,
    totalTrainingCount: 0,
    consecutiveLoginDays: 0
  });
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [lockedAchievements, setLockedAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const username = localStorage.getItem('tokenUser');
      if (!username) {
        console.error('No username found');
        return;
      }

      const response = await fetch(`http://localhost:4000/api/achievements/${username}`);
      const data = await response.json();

      if (data.success) {
        setUserStats(data.data.user);
        setUnlockedAchievements(data.data.unlockedAchievements);
        setLockedAchievements(data.data.lockedAchievements);
      } else {
        console.error('Failed to fetch achievements:', data.message);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const getProgressPercentage = () => {
    return Math.min((userStats.experience / 10) * 100, 100);
  };

  const getNextLevelRequirement = () => {
    return Math.max(0, 10 - userStats.experience);
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="achievements-container">
          <div className="loading-spinner">加载中...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="achievements-container">
        <h1 className="achievements-title">成就系统</h1>
        
        {/* 用户统计信息 */}
        <div className="user-stats-card">
          <div className="stats-header">
            <h2>用户统计</h2>
            <div className="username">@{userStats.username}</div>
          </div>
          
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">当前等级</div>
              <div className="stat-value level-badge">Lv.{userStats.level}</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-label">经验值</div>
              <div className="stat-value">{userStats.experience}/10</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-label">累计训练</div>
              <div className="stat-value">{userStats.totalTrainingCount}次</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-label">连续登录</div>
              <div className="stat-value">{userStats.consecutiveLoginDays}天</div>
            </div>
          </div>
          
          {/* 经验值进度条 */}
          <div className="progress-section">
            <div className="progress-label">
              距离下次升级还需 {getNextLevelRequirement()} 次成功训练
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {userStats.experience}/10 ({getProgressPercentage().toFixed(1)}%)
            </div>
          </div>
        </div>

        {/* 已解锁成就 */}
        <div className="achievements-section">
          <h2 className="section-title">
            🏆 已解锁成就 ({unlockedAchievements.length})
          </h2>
          <div className="achievements-grid">
            {unlockedAchievements.map((achievement) => (
              <div key={achievement._id} className="achievement-card unlocked">
                <div className="achievement-icon">{achievement.icon}</div>
                <div className="achievement-content">
                  <h3 className="achievement-name">{achievement.name}</h3>
                  <p className="achievement-description">{achievement.description}</p>
                  <div className="achievement-date">
                    解锁时间: {new Date(achievement.unlockedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {unlockedAchievements.length === 0 && (
            <div className="empty-state">
              <p>还没有解锁任何成就，继续努力吧！</p>
            </div>
          )}
        </div>

        {/* 未解锁成就 */}
        <div className="achievements-section">
          <h2 className="section-title">
            🔒 未解锁成就 ({lockedAchievements.length})
          </h2>
          <div className="achievements-grid">
            {lockedAchievements.map((achievement) => (
              <div key={achievement._id} className="achievement-card locked">
                <div className="achievement-icon locked-icon">🔒</div>
                <div className="achievement-content">
                  <h3 className="achievement-name">{achievement.name}</h3>
                  <p className="achievement-description">{achievement.description}</p>
                  <div className="achievement-condition">
                    达成条件: {getConditionText(achievement.condition)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 通知 */}
        {notification && (
          <div className="notification">
            <div className="notification-content">
              🎉 {notification}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// 获取成就条件的中文描述
const getConditionText = (condition) => {
  const conditionMap = {
    'first_training': '完成第一次训练',
    'ten_trainings': '累计成功训练10次',
    'level_2': '达到2级',
    'level_5': '达到5级',
    'level_10': '达到10级',
    'consecutive_7_days': '连续训练7天',
    'consecutive_15_days': '连续训练15天',
    'first_test_failure': '测试失败一次',
    'five_test_failures': '累计测试失败5次'
  };
  
  return conditionMap[condition] || condition;
};

export default Achievements;