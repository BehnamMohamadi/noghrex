import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  await mongoose.connect(env.mongoUri);

  console.log("MongoDB connected");
  console.log("Mongo URI:", env.mongoUri);
  console.log("Mongo host:", mongoose.connection.host);
  console.log("Mongo port:", mongoose.connection.port);
  console.log("Mongo database:", mongoose.connection.name);

  const hello = await mongoose.connection.db.admin().command({ hello: 1 });

  if (!hello.setName && hello.msg !== "isdbgrid") {
    throw new Error(
      "MongoDB must support transactions. Run npm run db:local and use the local replica-set URI.",
    );
  }
}
