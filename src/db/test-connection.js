import { supabase } from "./client.js";

const testConnection = async () => {
    console.log('testing connection to DB');
    const {data, error} = await supabase.from('runs').select('count');

    if(error){
        console.error('Conection Error: ', error.message);
        process.exit(1)
    }

    console.log('Conection successfull');

    const {data:run, error:insertError} = await supabase.from('runs').insert({
        topic: 'Conection Test',
        status: 'created'
    }).select().single();

    if(insertError){
        console.error('Error trying to insert into BD: ', insertError.message);
        process.exit(1)
    }

    console.log('Run created: ', run.id);

    await supabase.from('run').delete().eq('id', run.id);
    console.log('Test run eliminated')
}

testConnection();
