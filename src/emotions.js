/* ============================================================
   emotions.js — Feelings-wheel taxonomy.

   The EQ-building core: each broad family expands into nuanced
   feelings, so over time people learn to name "resentful" instead
   of just "angry". Loosely based on the Willcox feelings wheel.
   ============================================================ */

export const FAMILIES = [
  {
    key: 'joyful', label: 'Joyful', emoji: '😊',
    feelings: ['content', 'proud', 'excited', 'hopeful', 'playful', 'grateful', 'inspired', 'confident'],
  },
  {
    key: 'calm', label: 'Calm', emoji: '😌',
    feelings: ['relaxed', 'relieved', 'thoughtful', 'present', 'secure', 'balanced'],
  },
  {
    key: 'strong', label: 'Strong', emoji: '💪',
    feelings: ['motivated', 'focused', 'capable', 'determined', 'valued', 'in control'],
  },
  {
    key: 'sad', label: 'Sad', emoji: '😞',
    feelings: ['lonely', 'disappointed', 'hurt', 'guilty', 'ashamed', 'hopeless', 'drained', 'grieving'],
  },
  {
    key: 'angry', label: 'Angry', emoji: '😠',
    feelings: ['frustrated', 'resentful', 'irritated', 'jealous', 'disrespected', 'bitter', 'furious'],
  },
  {
    key: 'afraid', label: 'Afraid', emoji: '😟',
    feelings: ['anxious', 'overwhelmed', 'insecure', 'worried', 'stressed', 'helpless', 'nervous'],
  },
  {
    key: 'surprised', label: 'Surprised', emoji: '😮',
    feelings: ['confused', 'amazed', 'shocked', 'curious', 'conflicted'],
  },
  {
    key: 'disconnected', label: 'Disconnected', emoji: '😶',
    feelings: ['numb', 'bored', 'distant', 'withdrawn', 'indifferent', 'tired'],
  },
];

export function familyOf(feeling) {
  for (const fam of FAMILIES) {
    if (fam.feelings.includes(feeling) || fam.key === feeling) return fam;
  }
  return null;
}
