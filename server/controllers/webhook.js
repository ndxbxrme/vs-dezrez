const superagent = require('superagent');
module.exports = (ndx) => {
    const changeList = [];
    let bootingUp = true;
    let webhookCount = 0;
    let pollCount = 0;
    let startDate = new Date();
    const pollForChanges = async () => {
        pollCount++;
        if (bootingUp && !changeList.length) {
            bootingUp = false;
            console.log('posting to', process.env.VS_PROPERTY_WEBHOOK);
            superagent.post(process.env.VS_PROPERTY_WEBHOOK).end();
        }
        if (changeList.length) {
            const change = changeList.shift();
            console.log(changeList.length, change);
            try {
                switch (change.type) {
                    case 'property':
                        //get role
                        const role = await ndx.dezrez.get('role/{id}', null, { id: change.id });
                        role._id = +change.id;
                        ndx.database.upsert('role', role);
                        //tenantrole
                        if (role && role.TenantRoleId) {
                            const tenantrole = await ndx.dezrez.get('role/{id}', null, { id: role.TenantRoleId });
                            tenantrole._id = +role.TenantRoleId;
                            ndx.database.upsert('role', tenantrole);
                        }
                        //purchasingrole
                        if (role && role.PurchasingRoleId) {
                            const purchasingrole = await ndx.dezrez.get('role/{id}', null, { id: role.PurchasingRoleId });
                            purchasingrole._id = +role.PurchasingRoleId;
                            ndx.database.upsert('role', purchasingrole);
                        }
                        //agent_ref
                        if (role && role.agent_ref) {
                            const agent_ref = await ndx.dezrez.get('role/{id}', null, { id: role.agent_ref });
                            agent_ref._id = +role.agent_ref;
                            ndx.database.upsert('role', agent_ref);
                        }
                        //property/:id
                        if (role && role.PropertyId) {
                            const property = await ndx.dezrez.get('property/{id}', null, { id: role.PropertyId });
                            property._id = +role.PropertyId;
                            ndx.database.upsert('property', property);
                        }
                        //property/:id/owners
                        if (role && role.PropertyId) {
                            const propertyowners = {
                                _id: +role.PropertyId,
                                body: await ndx.dezrez.get('property/{id}/owners', null, { id: role.PropertyId })
                            }
                            ndx.database.upsert('propertyowners', propertyowners);
                        }
                        //inform vs-property
                        if (!bootingUp) superagent.post(process.env.VS_PROPERTY_WEBHOOK).end();
                        break;
                    case 'offer':
                        const offers = {
                            _id: +change.id,
                            body: await ndx.dezrez.get('role/{id}/offers', null, { id: change.id })
                        };
                        ndx.database.upsert('offers', offers);
                        if (!bootingUp) superagent.post(process.env.VS_PROPERTY_WEBHOOK).end();
                        break;
                    case 'viewing':
                        const viewings = {
                            _id: +change.id,
                            body: await ndx.dezrez.get('role/{id}/viewings', null, { id: change.id })
                        };
                        ndx.database.upsert('viewings', viewings);
                        const viewingsbasic = {
                            _id: +change.id,
                            body: await ndx.dezrez.get('role/{id}/viewingsbasic', null, { id: change.id })
                        };
                        ndx.database.upsert('viewingsbasic', viewingsbasic);
                        if (!bootingUp) superagent.post(process.env.VS_PROPERTY_WEBHOOK).end();
                        break;
                    case 'event':
                        const events = {
                            _id: +change.id,
                            body: await ndx.dezrez.get('role/{id}/events', { pageSize: 2000 }, { id: change.id })
                        };
                        ndx.database.upsert('events', events);
                        if (!bootingUp) superagent.post(process.env.VS_PROPERTY_WEBHOOK).end();
                        break;
                }
            } catch (e) {
                console.error('error', e);
            }
        }
        setTimeout(pollForChanges, bootingUp ? 3000 : 30000);
    }
    const updateSearch = async () => {
        const properties = await ndx.dezrez.fetchProperties(1);
        ndx.database.delete('searches', {_id:1});
        await ndx.database.upsert('searches', {_id:1,properties:properties});
        return properties;
    }
    ndx.database.on('ready', async () => {
        bootingUp = true;
        await updateSearch();
        pollForChanges();
    });
    ndx.app.post('/refresh', async (req, res, next) => {
        const properties = await updateSearch();
        bootingUp = true;
        properties.forEach((property, index) => {
            //if(index > 0) return;
            changeList.push({ id: property.RoleId, type: 'property' });
            changeList.push({ id: property.RoleId, type: 'offer' });
            changeList.push({ id: property.RoleId, type: 'viewing' });
            changeList.push({ id: property.RoleId, type: 'event' });
        });
        res.end('ok');
    });
    ndx.app.post('/refresh/:id', async (req, res, next) => {
        if(req.params.id && +req.params.id > 0) {
            changeList.push({ id: +req.params.id, type: 'property' });
            changeList.push({ id: +req.params.id, type: 'offer' });
            changeList.push({ id: +req.params.id, type: 'viewing' });
            changeList.push({ id: +req.params.id, type: 'event' });
            return res.end('ok');
        }
        res.end('bad id');
    })
    ndx.app.post('/refresh-searches', async (req, res, next) => {
        await updateSearch();
        superagent.post(process.env.VS_PROPERTY_WEBHOOK).end();
        res.end('ok');
    });
    ndx.app.get('/status', (req, res, next) => {
        res.json({
            bootingUp,
            changeList,
            webhookCount,
            pollCount,
            startDate
        })
    })
    ndx.app.post('/webhook', async (req, res, next) => {
        if (req.body) {
            webhookCount++;
            //ndx.database.insert('postdata', req.body);
            const event = req.body;
            if(event && event.EventType && event.EventType==='GenericEvent') {
                return res.end('ok');
            }
            let changeType = ['offer', 'viewing', 'event'].reduce((res, type) => res || (JSON.stringify(event).toLowerCase().includes(type) ? type : null), null);
            if (!changeType) changeType = 'property';
            if (changeType === 'event' && event.PropertyRoleId === event.RootEntityId && event.ChangeType === 'Updated') {
                changeType = 'property';
            };
            if(!event.PropertyRoleId) {
                return res.end('ok');
            }
            const change = {
                id: event.PropertyRoleId || event.RootEntityId,
                type: changeType
            };
            if (change.id === 0) {
            }
            if (event.AllChanges) {
                event.AllChanges.forEach(async change => {
                    if (change.PropertyName === 'RoleStatus') {
                        roleStatusEvents.push(event);
                        if (['InstructionToLet', 'InstructionToSell', 'OfferAccepted'].includes(change.PropertyName)) {
                            await updateSearch();
                        }
                        else {
                            //delisted
                            ndx.database.delete('events', { _id: +change.id });
                            ndx.database.delete('viewingsbasic', { _id: +change.id });
                            ndx.database.delete('offers', { _id: +change.id });
                            const role = await ndx.database.selectOne('role', { _id: +change.id });
                            if (role) {
                                ndx.database.delete('owners', { _id: +role.PropertyId });
                                ndx.database.delete('property', { _id: +role.PropertyId });
                                if (role.TenantRoleId) {
                                    ndx.database.delete('role', { _id: +role.TenantRoleId });
                                }
                                if (role.PurchasingRoleId) {
                                    ndx.database.delete('role', { _id: +role.PurchasingRoleId });
                                }
                                if (role.agent_ref) {
                                    ndx.database.delete('role', { _id: +role.agent_ref });
                                }
                                ndx.database.delete('role', { _id: +role._id });
                            }
                            await updateSearch();
                            return;
                        }
                    }
                })
            }
            const prevChange = changeList.find(prevChange => change.id === prevChange.id && change.type === prevChange.type);
            if (!prevChange && change.id) {
                changeList.push(change);
            }
        }
        res.end('ok');
    });
};