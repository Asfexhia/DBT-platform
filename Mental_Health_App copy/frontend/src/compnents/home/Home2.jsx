import React, { useState } from 'react';

const Home2 = () => {
  const [active, setActive] = useState('Wise Mind');

  return (
    <section className="bg-white dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-6 text-gray-900 dark:text-gray-100">
        <h2 className="text-3xl font-extrabold mb-4">Mindfulness Skills</h2>

        <p className="mb-6 leading-relaxed">
          Being mindful is a way of living awake with our eyes wide open. The act of consciously focusing the mind in the moment without judgment or attachment. It is the practice of bringing the mind back to the current moment over and over again. Meditation is a form of mindfulness. It is estimated that 95% of our lives we are simply existing, and it is only 5% of our time that we are self-aware...we are truly operating from our conscious mind.
        </p>

        {/* Tabs */}
        <div className="flex gap-4 mb-6" role="tablist" aria-label="Mindfulness tabs">
          {['Wise Mind', 'What', 'How'].map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              role="tab"
              aria-selected={active === t}
              className={`text-lg font-semibold px-4 py-2 rounded-md focus:outline-none ${active === t ? 'bg-teal-100 dark:bg-teal-800 text-teal-800 dark:text-teal-100' : 'text-gray-800 dark:text-gray-100'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="prose max-w-none text-gray-800 dark:text-gray-100">
          {active === 'Wise Mind' && (
            <div>
              <h3 className="text-2xl font-bold mb-2">
                <a href="https://www.youtube.com/watch?v=MLnUvxg_9po" target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Wise Mind Skill
                </a>
              </h3>
              <p className="mb-4">A person using Wise Mind uses some input from both the Emotion Mind and some input from Logic Mind and then adds intuitive knowing. This person focuses on getting things done effectively and the focus is on the experience.</p>

              <h4 className="font-semibold">Emotion Mind</h4>
              <p className="mb-2">A person is in Emotion Mind when their emotions are in control. Logical or reasonable thinking is not present. They seem out of control. They may report feeling overwhelmed, stuck, or confused and simply cannot find a resolution or a way to move forward.</p>

              <h4 className="font-semibold">Reasonable Mind</h4>
              <p className="mb-2">A person in Logic Mind seems calm, cool, and collected. They approach a situation with knowledge intellectually. They are thinking logically or rationally. They pay attention to the facts and ignore emotions. They are practical and cool in developing a plan. Decisions and actions are controlled by logic.</p>

              <h4 className="font-semibold">Wise Mind</h4>
              <p> A person using Wise Mind uses input from both Emotion Mind and from Logic Mind; and adds intuitive knowing. This person focuses on getting things done. Their focus is on the experience.</p>
            </div>
          )}

          {active === 'What' && (
            <div>
              <h3 className="text-2xl font-bold mb-2">
                <a href="https://www.youtube.com/watch?v=JUSaQL1_zXE" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    What Skill
                </a>
              </h3>
              <p className="mb-3">DBT encourages us to live our lives fully. To do so, it's most effective to: observe, describe, and participate in the activity of the moment throughout our day.</p>

              <h4 className="font-semibold">Observe</h4>
              <ul className="list-disc ml-6 mb-3">
                <li>Pay attention to events, emotions, and thoughts.</li>
                <li>Try not to terminate them when they are painful.</li>
                <li>Try not to prolong them when they are pleasant.</li>
                <li>Allow yourself to experience with awareness.</li>
              </ul>

              <h4 className="font-semibold">Describe</h4>
              <ul className="list-disc ml-6 mb-3">
                <li>Describe events, label emotions, identify thoughts.</li>
                <li>Try not to take emotions and thoughts as accurate and exact reflections of events.</li>
                <li>List "just the facts" – No need to label or judge.</li>
              </ul>

              <h4 className="font-semibold">Participate</h4>
              <ul className="list-disc ml-6">
                <li>Enter completely into the activity of the moment.</li>
                <li>Try not to be self-conscious.</li>
                <li>Be spontaneous and give attention to the activity.</li>
              </ul>
            </div>
          )}

          {active === 'How' && (
            <div>
              <h3 className="text-2xl font-bold mb-2">
                <a href="https://www.youtube.com/watch?v=oYdrMpnE93s" target="_blank" rel="noopener noreferrer" className="hover:underline">
                How Skill
                </a>
              </h3>
              <p className="mb-3">To live fully, DBT encourages us to be non-judgmental, mindful of the moment, and to focus on the desired outcome for each situation.</p>

              <h4 className="font-semibold">Non-Judgmental</h4>
              <p className="mb-3">Taking a non-judgmental stance means – do not judge things as good or bad, right or wrong. It is effective to focus on the consequence of behavior instead of judging others or ourselves. It is helpful to fully describe what is observed and collect just the facts; without judging those involved or the circumstances.</p>

              <h4 className="font-semibold">One Mindful</h4>
              <p className="mb-3">It is the ability to focus the mind (and awareness) in the current moment. Try not to become distracted by thoughts or images of the past. Try to put your worries about the future away and focus on the task at hand. Engage in the activity of the moment with your eyes wide open.</p>

              <h4 className="font-semibold">Effective</h4>
              <p>Do what works. Try not to worry about being “right”. Focus on the outcome you desire.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Home2;