import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const TestAccessRoute = ({ children }) => {
  const { username } = useParams();
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessInfo, setAccessInfo] = useState(null);

  useEffect(() => {
    const checkTestAccess = async () => {
      try {
        const response = await axios.get(`http://localhost:4000/api/test-access/${username}`);
        setHasAccess(response.data.hasAccess);
        setAccessInfo(response.data);
      } catch (error) {
        console.error('检查测试访问权限失败:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      checkTestAccess();
    }
  }, [username]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">检查访问权限中...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">测试功能未解锁</h2>
          <p className="text-gray-600 mb-4">
            {accessInfo?.message || '您需要更多的训练经验才能解锁测试功能'}
          </p>
          {accessInfo && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-blue-800">
                当前进度: {accessInfo.currentProgress} / {accessInfo.requiredProgress}
              </p>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${(accessInfo.currentProgress / accessInfo.requiredProgress) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
          <button 
            onClick={() => window.location.href = `/${username}/therapist`}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            返回训练页面
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default TestAccessRoute;