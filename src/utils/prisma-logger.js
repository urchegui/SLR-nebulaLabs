import { supabase } from "../db/client.js";

export const logPrismaEvent = async (runId, stage, eventType, count, notes=null) =>{
    const {error} = await supabase.from('prisma_events').insert({
        run_id:runId,
        stage,
        event_type: eventType,
        count,
        notes
    })
    if(error) return console.error(`Error loggin PRISMA event [${eventType}]: `, error.message);
    
    console.log(`PRISMA [${stage}] ${eventType}: ${count}`);
}

export const logAudit = async (runId, userId, action, entityType, entityId, newValue, metaData = null) =>{
    const {error} = supabase.from('audit_log').insert({
        run_id: runId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        new_value: newValue,
        metaData
    })
    if (error) return console.error(`Error loggin audit [${action}]: `, error.message);
}