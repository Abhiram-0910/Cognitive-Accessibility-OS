const mongoose = require('mongoose');

// Main Game Schema
const gameSchema = new mongoose.Schema({
    gameId: { type: String, required: true },
    name: { type: String, required: true },
    questions: [
      {
        type: mongoose.Schema.Types.Mixed, // Can hold either questionType1Schema or questionType2Schema
        required: true,
      },
    ],
  });

const Game = mongoose.model('Game', gameSchema); // Main game model

module.exports=Game;