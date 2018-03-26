'use strict';
var textHelper = require('./textHelper'),
    storage = require('./storage');

var registerIntentHandlers = function (intentHandlers, skillContext) {
    //##########################################################
    // Add Person is used to explicitly create a task list for
    // a person.
    // Slots:
    //   * Person
    //##########################################################
    intentHandlers.AddPersonIntent = function (intent, session, response) {
        var newPersonName = intent.slots.Person.value;
        if (!newPersonName) {
            response.ask('OK. Who do you want to add?', 'Who do you want to add?');
            return;
        }
        storage.loadTasks(session, function (currentTasks) {
            var speechOutput,
                reprompt;
            if (currentTasks.data.tasks[newPersonName] !== undefined) {
                speechOutput = newPersonName + ' has already been added.';

                if (skillContext.needMoreHelp) {
                    response.ask(speechOutput + ' What else?', 'What else?');
                } else {
                    response.tell(speechOutput);
                }
                return;
            }
            speechOutput = newPersonName + ' has been added. ';
            currentTasks.data.persons.push(newPersonName);
            currentTasks.data.tasks[newPersonName] = [];
            if (skillContext.needMoreHelp) {
                if (currentTasks.data.persons.length == 1) {
                    speechOutput += 'You can say, I am Done Adding People. Now who\'s your next person?';
                    reprompt = textHelper.nextHelp;
                } else {
                    speechOutput += 'Who is your next person?';
                    reprompt = textHelper.nextHelp;
                }
            }
            currentTasks.save(function () {
                if (reprompt) {
                    response.ask(speechOutput, reprompt);
                } else {
                    response.tell(speechOutput);
                }
            });
        });
    };

    //##########################################################
    // Add Task is used to append a task to a specific person's
    // task list
    // Slots:
    //   * Person
    //   * Task
    //##########################################################
    intentHandlers.AddTaskIntent = function (intent, session, response) {
        var personName = intent.slots.Person.value,
            task = intent.slots.Task.value;
        if (!personName) {
            response.ask('sorry, I did not hear the person\'s name, please say that again', 'Please say the name again');
            return;
        }
        storage.loadTasks(session, function (currentTasks) {
            var targetPerson,
                speechOutput = '';
            for (var i = 0; i < currentTasks.data.persons.length; i++) {
                if (currentTasks.data.persons[i] === personName) {
                    targetPerson = currentTasks.data.persons[i];
                    break;
                }
            }
            if (!targetPerson) {
                // If we dont' already know this person, go ahead
                // and implicitly create a new list for them. We don't
                // want to force them to use an extra step to add them.
                //
                // Tradeoff: Alexa may mis-hear a name, resulting in an extra
                // list
                speechOutput = personName + ' has been added. ';
                currentTasks.data.persons.push(personName);
                targetPerson = personName;
                currentTasks.data.tasks[targetPerson] = [];
            }
            currentTasks.data.tasks[targetPerson].push(task);

            speechOutput += ' added task ' + task + ' for ' + targetPerson + '. ';
            currentTasks.save(function () {
                response.tell(speechOutput);
            });
        });
    };

    //##########################################################
    // List Tasks is used to get the list of tasks for a particular
    // person
    // Slots:
    //   * Person
    //##########################################################
    intentHandlers.ListTasksIntent = function (intent, session, response) {
        var personName = intent.slots.Person.value;
        if (!personName) {
            response.ask('sorry, I did not hear the person\'s name, please say that again', 'Please say the name again');
            return;
        }
        storage.loadTasks(session, function (currentTasks) {
            var targetPerson,
                speechOutput = '',
                taskCount = 0,
                cardContent = '';
            if (currentTasks.data.persons.length < 1) {
                response.ask('sorry, no one has been added yet, what can I do for you?', 'what can I do for you?');
                return;
            }
            for (var i = 0; i < currentTasks.data.persons.length; i++) {
                if (currentTasks.data.persons[i] === personName) {
                    targetPerson = currentTasks.data.persons[i];
                    break;
                }
            }
            if (!targetPerson) {
                response.ask('Sorry, I don\'t know person ' + personName + '. What else?', 'I don\'t know ' + personName + '. What else?');
                return;
            }
            // We will output the task list both by voice, and as a card in the
            // Alexa app.
            currentTasks.data.tasks[targetPerson].forEach(function (task) {
                taskCount += 1;
                speechOutput += 'Task ' + taskCount + ' is ' + task + '. ';
                cardContent += 'No. ' + taskCount + ' - ' + task + '\n';
            });
            speechOutput += 'What else?';
            response.ask(speechOutput, "Tasks for " + targetPerson, cardContent);
        });
    };

    //##########################################################
    // Remove Task is used to remove a single task from a person's
    // list, by task number
    // Slots:
    //   * Person
    //   * Number
    //##########################################################
    intentHandlers.RemoveTaskIntent = function (intent, session, response) {
        var personName = intent.slots.Person.value,
            taskNumber = intent.slots.Number,
            taskIndex = parseInt(taskNumber.value);
        if (!personName) {
            response.ask('sorry, I did not hear the person\'s name, please say that again', 'Please say the name again');
            return;
        }
        storage.loadTasks(session, function (currentTasks) {
            var targetPerson,
                taskNumber,
                speechOutput = '';
            if (currentTasks.data.persons.length < 1) {
                response.ask('sorry, no one has been added yet, what can I do for you?', 'what can I do for you?');
                return;
            }
            for (var i = 0; i < currentTasks.data.persons.length; i++) {
                if (currentTasks.data.persons[i] === personName) {
                    targetPerson = currentTasks.data.persons[i];
                    break;
                }
            }
            if (!targetPerson) {
                response.ask('Sorry, I don\'t know person ' + personName + '. What else?', 'I don\'t know ' + personName + '. What else?');
                return;
            }
            if (taskIndex < 1 || currentTasks.data.tasks[targetPerson].length < taskIndex) {
                response.ask('sorry, I didn\'t find task ' + taskIndex +' for ' + targetPerson + '. What else?');
                return;
            }
            currentTasks.data.tasks[targetPerson].splice(taskIndex - 1, 1);
            speechOutput += 'Removed item ' + taskIndex + ' for ' + targetPerson + '. ';
            currentTasks.save(function () {
                response.ask(speechOutput+' What else ?');
            });
        });
    };

    //##########################################################
    // Clear Tasks clears out the entire task list of a particular
    // person
    // Slots:
    //   * Person
    //##########################################################
    intentHandlers.ClearTasksIntent = function (intent, session, response) {
        var personName = intent.slots.Person.value;
        if (!personName) {
            response.ask('sorry, I did not hear the person\'s name, please say that again', 'Please say the name again');
            return;
        }
        storage.loadTasks(session, function (currentTasks) {
            var targetPerson,
                speechOutput = '',
                taskCount = 0,
                cardContent = '';
            if (currentTasks.data.persons.length < 1) {
                response.ask('sorry, no one has been added yet, what can I do for you?', 'what can I do for you?');
                return;
            }
            for (var i = 0; i < currentTasks.data.persons.length; i++) {
                if (currentTasks.data.persons[i] === personName) {
                    targetPerson = currentTasks.data.persons[i];
                    break;
                }
            }
            if (!targetPerson) {
                response.ask('Sorry, I don\'t know person ' + personName + '. What else?', 'I don\'t know ' + personName + '. What else?');
                return;
            }
            currentTasks.data.tasks[targetPerson] = []
            speechOutput += 'Tasks cleared for ' + targetPerson;
            currentTasks.save(function () {
               response.ask(speechOutput+' What else ?');
            });
        });
    };

    //##########################################################
    // Reset puts us back in a clean, freshly initialized state with
    // no task lists
    //##########################################################
    intentHandlers.ResetIntent = function (intent, session, response) {
        storage.loadTasks(session, function (currentTasks) {
            if (currentTasks.data.persons.length === 0) {
                response.ask('Task list reset. Who would you like to add?',
                    'Please tell me who you would like to add?');
                return;
            }
            currentTasks.data.persons = []
            currentTasks.data.tasks = {}
            currentTasks.save(function () {
                var speechOutput = 'All task lists reset. ';
                if (skillContext.needMoreHelp) {
                    speechOutput += '. You can add tasks for a person, add another person, or exit. What would you like?';
                    var repromptText = 'You can add tasks for a person, add another person, or exit. What would you like?';
                    response.ask(speechOutput, repromptText);
                } else {
                    response.tell(speechOutput);
                }
            });
        });
    };

    //##########################################################
    // Standard help message
    //##########################################################
    intentHandlers['AMAZON.HelpIntent'] = function (intent, session, response) {
        var speechOutput = textHelper.completeHelp;
        if (skillContext.needMoreHelp) {
            response.ask(textHelper.completeHelp + ' So, how can I help?', 'How can I help?');
        } else {
            response.tell(textHelper.completeHelp);
        }
    };

    //##########################################################
    // Standard cancel message
    //##########################################################
    intentHandlers['AMAZON.CancelIntent'] = function (intent, session, response) {
        if (skillContext.needMoreHelp) {
            response.tell('Okay. Whenever you\'re ready, you can start assigning tasks to the people in your family.');
        } else {
            response.tell('');
        }
    };

    //##########################################################
    // Standard stop message
    //##########################################################
    intentHandlers['AMAZON.StopIntent'] = function (intent, session, response) {
        if (skillContext.needMoreHelp) {
            response.tell('Okay. Whenever you\'re ready, you can start assigning tasks to the people in your family.')
        } else {
            response.tell('');
        }
    };
};

exports.register = registerIntentHandlers;
