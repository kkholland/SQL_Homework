const express = require('express');
const pgp = require('pg-promise')();
const router = express.Router();

router.use(express.json());

// *** Database here
const db = pgp({
    database: 'weather'
});

//checking if connection worked
// db.many('SELECT * from states').then( ()=> console.log('works!'));

// *****

// get all states
router.get('/states', async (req, res) => {
    res.json(await db.many('SELECT * from states'));
});

//city id, full state, full city
router.get('/cities', async (req, res) => {
    res.json(await db.many(`
        SELECT c.id, c.city_name as city, states.state_name as state
        FROM cities c 
        INNER JOIN states ON states.abbrev = c.state_abbrev;`));
});

//get specific state
// router.get('/states/:abbrev', async (req, res) => {
//     const result = await db.oneOrNone('SELECT * FROM states WHERE abbrev = $(abbrev)', {
//         abbrev: req.params.abbrev
//     });

//     if (!result) {
//         return res.status(404).send('The state could not be found');
//     }

//     res.json(result);
// });

// post - new state
router.post('/states', async (req, res) => {

    try{

        await db.none('INSERT INTO states (abbrev, state_name) VALUES ($(abbrev), $(state_name))', {
            abbrev: req.body.abbrev,
            state_name: req.body.state_name
        });

        const state = await db.one('SELECT abbrev, state_name FROM states WHERE abbrev = $(abbrev)', {
            abbrev: req.body.abbrev
        });

        res.status(201).json(state);

    } catch (error) {
        if (error.constraint === 'states_pkey'){
            return res.status(400).send('The state already exists');
        }
        console.log(error);
        res.status(500).send(error);
    }
    
});


// post new city
router.post('/cities', async (req, res) => {

    try{

        const ins = await db.oneOrNone('INSERT INTO cities (state_abbrev, city_name, climate) VALUES ($(state_abbrev), $(city_name), $(climate)) RETURNING id', {
            state_abbrev: req.body.state_abbrev,
            city_name: req.body.city_name,
            climate: req.body.climate
        });

        const city = await db.one('SELECT state_abbrev, city_name, climate FROM cities WHERE id = $(id)', { id: ins.id });

        res.status(201).json(city);

    } catch (error) {
        if (error.constraint === 'city_state_name'){
            return res.status(400).send('The city & state already exists');
        }
        console.log(error);
        res.status(500).send(error);
    }
    
});


// post new temp
router.post('/temperatures', async (req, res) => {

    try{

        const ins = await db.oneOrNone('INSERT INTO temperatures (city_id, temperature, date) VALUES ($(city_id), $(temperature), $(date)) RETURNING id', {
            city_id: req.body.city_id,
            temperature: req.body.temperature,
            date: req.body.date
        });

        const temp = await db.one('SELECT city_id, temperature, date FROM temperatures WHERE id = $(id)', { id: ins.id });

        res.status(201).json(temp);

    } catch (error) {
        if (error.constraint === 'city_date_combo'){
            return res.status(400).send('A temperature for this city and date already exists');
        }
        console.log(error);
        res.status(500).send(error);
    }
    
});


// get states /:abbrev - return a list of cities in that state
router.get('/states/:abbrev', async (req, res) => {
    try{

        const result = await db.many('SELECT cities.city_name FROM cities WHERE cities.state_abbrev = $(abbrev);', {
            abbrev: req.params.abbrev
        });

        res.json(result);

    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
    
});

// get citites/id - return city with average temperature
router.get('/cities/:id', async (req, res) => {
    const result = await db.one('SELECT c.city_name, AVG(t.temperature) FROM temperatures t INNER JOIN cities c ON c.id = t.city_id WHERE c.id = $(id) GROUP BY c.city_name;', {
        id: req.params.id
    });

    if (!result) {
        return res.status(404).send('The city could not be found');
    }

    res.json(result);
})

// get /temp/:climate - return avg temp for that climate
router.get('/temperatures/:climate', async (req, res) => {
    const result = await db.one('SELECT c.climate, AVG(t.temperature) FROM temperatures t INNER JOIN cities c ON c.id = t.city_id WHERE c.climate = $(climate) GROUP BY c.climate;', {
        climate: req.params.climate
    });

    if (!result) {
        return res.status(404).send('The climate could not be found');
    }

    res.json(result);
});

// delete a state
router.delete('/states/:abbrev', async (req, res) => {

    try{
        await db.none('DELETE FROM states WHERE abbrev = $(abbrev);', {
            abbrev: req.params.abbrev
        });
    
        res.status(204).send();
    } catch (error) {
        if (error.constraint === 'cities_state_abbrev_fkey'){
            return res.status(400).send(error.detail);
        }
        console.log(error);
        res.status(500).send(error);
    }
  
});

// delete a city
router.delete('/cities/:id', async (req, res) => {
    await db.none('DELETE FROM cities WHERE id = $(id);', {
        id: +req.params.id
    });

    res.status(204).send();
});

// delete a temperature
router.delete('/temperatures/:id', async (req, res) => {
    await db.none('DELETE FROM temperatures WHERE id = $(id);', {
        id: +req.params.id
    });

    res.status(204).send();
});


//update a state
router.put('/states/:abbrev', async (req, res) => {

    try{
        const state = await db.oneOrNone('SELECT abbrev, state_name FROM states WHERE abbrev = $(abbrev)', {
            abbrev: req.params.abbrev
        });

        if (!state){
            return res.status(404).send('State does not exist.')
        }

        await db.oneOrNone('UPDATE states SET abbrev = $(newAbbrev), state_name = $(newState_name) WHERE abbrev = $(abbrev)', {
            abbrev: req.params.abbrev,
            newAbbrev: req.body.abbrev,
            newState_name: req.body.state_name
        });

        const newState = await db.one('SELECT abbrev, state_name FROM states WHERE abbrev = $(newAbbrev)', {
            newAbbrev: req.body.abbrev
        });

        res.status(201).json(newState);

    } catch (error) {
        
        console.log(error);
        res.status(500).send(error);
    }
    
});


//update a city
router.put('/cities/:id', async (req, res) => {

    try{
        const result = await db.one('SELECT city_name FROM cities WHERE id = $(id);', {
            id: +req.params.id
        });
    
        if (!result) {
            return res.status(404).send('The city could not be found');
        }

        await db.oneOrNone('UPDATE cities SET state_abbrev = $(newAbbrev), city_name = $(newCity_name), climate = $(newClimate) WHERE id = $(id)', {
            id: +req.params.id,
            newAbbrev: req.body.abbrev,
            newCity_name: req.body.city_name,
            newClimate: req.body.climate,
        });

        const newCity = await db.one('SELECT * FROM cities WHERE id = $(id)', {
            id: +req.params.id
        });

        res.status(201).json(newCity);

    } catch (error) {
        
        console.log(error);
        res.status(500).send(error);
    }
    
});



//update a temp
router.put('/temperatures/:id', async (req, res) => {

    try{
        const result = await db.one('SELECT temperature FROM temperatures WHERE id = $(id);', {
            id: +req.params.id
        });
    
        if (!result) {
            return res.status(404).send('The temperature record could not be found');
        }

        await db.oneOrNone('UPDATE temperatures SET city_id = $(newCityId), temperature = $(newTemperature), date = $(newDate) WHERE id = $(id)', {
            id: +req.params.id,
            newCityId: +req.body.city_id,
            newTemperature: +req.body.temperature,
            newDate: req.body.date,
        });

        const newTemp = await db.one('SELECT * FROM temperatures WHERE id = $(id)', {
            id: +req.params.id
        });

        res.status(201).json(newTemp);

    } catch (error) {
        
        console.log(error);
        res.status(500).send(error);
    }
    
});



module.exports = router;