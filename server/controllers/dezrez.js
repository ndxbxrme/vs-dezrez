module.exports = (ndx) => {
    ndx.app.post('/token', (req, res, next) => {
        res.json({accessToken:1234});
    });
    ['offers', 'events', 'viewings', 'viewingsbasic'].forEach(type => {
        ndx.app.get('/role/:id/' + type, async (req, res, next) => {
            if (req.params.id) {
                let offers = await ndx.database.selectOne(type, { _id: +req.params.id });
                if (offers) {
                    return res.json(offers.body);
                }
                try {
                    offers = await ndx.dezrez.get('role/{id}/' + type, null, req.params.id);
                    if (offers) {
                        ndx.database.upsert(type, {_id:+req.params.id, body:offers});
                        return res.json(offers);
                    }
                } catch (e) {
    
                }
            }
            res.json([]);
        });
    });
    ndx.app.get('/role/:id', async (req, res, next) => {
        if (req.params.id) {
            let role = await ndx.database.selectOne('role', { _id: +req.params.id });
            if (role) {
                return res.json(role);
            }
            try {
                role = await ndx.dezrez.get('role/{id}', null, req.params.id);
                if (role) {
                    role._id = +req.params.id;
                    ndx.database.upsert('role', role);
                    return res.json(role);
                }
            } catch (e) {

            }
        }
        res.json({});
    });
    ndx.app.get('/property/:id/owners', async (req, res, next) => {
        if (req.params.id) {
            let owners = await ndx.database.selectOne('propertyowners', { _id: +req.params.id });
            if (owners) {
                return res.json(owners.body);
            }
            try {
                owners = await ndx.dezrez.get('property/{id}/owners', null, req.params.id);
                if (owners) {
                    ndx.database.upsert('propertyowners', {_id:+req.params.id, body:owners});
                    return res.json(owners);
                }
            } catch (e) {

            }
        }
        res.json({});
    });
    ndx.app.get('/property/:id', async (req, res, next) => {
        if (req.params.id) {
            let property = await ndx.database.selectOne('property', { _id: +req.params.id });
            if (property) {
                return res.json(property);
            }
            try {
                property = await ndx.dezrez.get('property/{id}', null, req.params.id);
                if (property) {
                    property._id = +req.params.id;
                    ndx.database.upsert('property', property);
                    return res.json(property);
                }
            } catch (e) {

            }
        }
        res.json({});
    });
    ndx.app.post('/search', async (req, res, next) => {
        const properties = await ndx.database.select('property');
        if(properties && properties.length) {
            res.json({
                Collection: properties,
                CurrentCount: properties.length,
                PageSize: properties.length + 1
            });
        }
    })
    ndx.app.get('/stats/rightmove/:id', async (req, res, next) => {
        res.json(await ndx.dezrez.get('stats/rightmove/{id}', null, req.params.id));
    });
    ndx.app.get('/people/findbyemail', async (req, res, next) => {
        const email = req.query.email;
        res.json(await ndx.dezrez.get('people/findbyemail', {emailAddress:email}));
    });
    ndx.app.get('/people/:id/:status', async (req, res, next) => {
        res.json(await ndx.dezrez.get('people/{id}/' + req.params.status, null, req.params.id));
    });
    ndx.app.get('/prop', async (req, res, next) => {
        const prop = await ndx.dezrez.fetchProperty();
        res.json(prop);
    })
}