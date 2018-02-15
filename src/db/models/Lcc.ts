import { Schema, model } from 'mongoose';

const schema = new Schema({
    title: {type: String, required: true},
    lastSync: {type: Date, required: false},
});

export const Lcc = model('Lcc',schema);
