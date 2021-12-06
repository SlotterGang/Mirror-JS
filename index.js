//Initializes the discord client and requires the discord package.
const { Client, Intents } = require('discord.js');
const fs = require('fs');
const Enmap = require('enmap');


//Requires the config.json file, creates token as a constant
const config = require('./config.json');
const { CronJob } = require('cron');

//Creates instance of client
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]});

client.config = config; // we want config to be accessible anywhere client is

//This line runs once the discord client is ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    //now that we're ready, we can set all the triggers
    setTriggers();
});

fs.readdir("./events/", (err, files) => {
    if (err) return console.error(err);
    files.forEach(file => {
      const event = require(`./events/${file}`);
      let eventName = file.split(".")[0];
      // loading event name
      client.on(eventName, event.bind(null, client));
    });
});

client.commands = new Enmap();

fs.readdir("./commands/", (err, files) => {
    if (err) return console.error(err);
    files.forEach(file => {
        if (!file.endsWith(".js")) return;
        let props = require(`./commands/${file}`);
        let commandName = file.split(".")[0];
        console.log(`Attempting to load command ${commandName}`);
        client.commands.set(commandName, props);
    });
});

client.keywords = new Enmap();

fs.readdir("./keywords/", (err, files) => {
    if (err) return console.error(err);
    files.forEach(file => {
        if (!file.endsWith(".js")) return;
        let props = require(`./keywords/${file}`);
        let keywordName = file.split(".")[0];
        console.log(`Attempting to load keyword ${keywordName}`);
        client.keywords.set(keywordName, props);
    });
});

client.triggers = new Enmap({name: 'triggers'}); //named enmaps are persistent to the disk
client.cronJobs = [];
//make a function to run once the discord bot is ready
const setTriggers = () => {
    client.triggers.fetchEverything(); //make sure all the triggers are loaded in memory
    client.guilds.fetch(); //make sure all the guilds are accessible
    for (let [server, triggers] of client.triggers) {
        let guild = client.guilds.cache.get(server); //get the guild using the guild's ID
        let updatedTriggers = []; //we'll need to set the new job property for all of the triggers
        for(let trigger of triggers) { //for each trigger in that guild
            let channel = guild.channels.cache.get(trigger.channel); //get the channel to send the message to
            let message = {channel: channel}; // construct a crude message object to send to the command.run()
            let job = new CronJob(trigger.cronTime, () => {
                try {
                    //run the command with specified args
                    client.commands.get(trigger.commandName).run(client, message, trigger.args);
                } catch(err) {
                    message.channel.send(`Error with trigger ${trigger.commandName}: ${err}`);
                    job.stop();
                }
            });
            //add cronjob to array so we can access all the cronjobs from any command
            client.cronJobs.push(job);
            job.start();
            console.log(`Set triggered command ${trigger.commandName} at ${trigger.cronTime} for ${server}`);
            // pass start and stop functions
            trigger.stopJob = job.stop;
            trigger.startJob = job.start;
            updatedTriggers.push(trigger); //add modified trigger to new array
        }
        client.triggers.set(server, updatedTriggers); //set the trigger array to the new one (with updated job property)
    }
}




//Uses Token to login to the client
client.login(config.token);