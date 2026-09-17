import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/user.model.js';

async function main() {
  await connectDatabase();
  const passwordHash = await bcrypt.hash('LearnerPass123!', 12);
  const user = await UserModel.findOneAndUpdate(
    { email: 'learner@hanflix.local' },
    {
      $set: {
        name: 'Học Viên HanFlix',
        email: 'learner@hanflix.local',
        passwordHash,
        role: 'user',
        status: 'active',
        emailVerifiedAt: new Date(),
        emailVerificationRequired: false,
        learningProfile: { currentHsk: 3, goal: 'daily', topics: ['food', 'daily'] },
      },
    },
    { new: true, upsert: true },
  );
  console.log(`Learner test account ready: ${user.email}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => disconnectDatabase());
