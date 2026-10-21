"""Immutable interactive course: existing stories plus branching scenario variants."""
import json, hashlib
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2]
LEVELS=['A1','A2','B1','B2','C1']
# Each alternative changes the arrangement. Both branches retain a real trade-off.
# Tuple: alternative reply, consequence A, consequence B; EN / IT / Russian.
BRANCHES={
 'time':[
  ("Let's choose another day. I want more time together.","Scegliamo un altro giorno. Vorrei avere più tempo insieme.","Давай выберем другой день, чтобы провести вместе больше времени."),
  ("All right, seven. We have one hour together. We need to start with the main activity.","Va bene, alle sette. Abbiamo un'ora insieme. Dobbiamo iniziare con l'attività principale.","Начало в семь. У вас один час: главное занятие придётся поставить первым."),
  ("All right, another day. We have more time, but we need to check everyone's availability again.","Va bene, un altro giorno. Abbiamo più tempo, ma dobbiamo chiedere di nuovo quando sono liberi tutti.","Встречу переносим. Времени будет больше, но нужно заново согласовать дату с участниками.")],
 'budget':[
  ("Let's ask the venue for a group discount before we move.","Chiediamo uno sconto di gruppo prima di cambiare posto.","Прежде чем менять место, давай попросим групповую скидку."),
  ("The free place is available. The journey is longer, so we need to explain how to get there.","Il posto gratuito è disponibile. Il viaggio è più lungo, quindi dobbiamo spiegare come arrivare.","Бесплатное место доступно. Дорога длиннее, поэтому нужны новые указания."),
  ("They can offer ten per person. We can stay here, but we must confirm the number of people today.","Possono offrire dieci euro a persona. Possiamo restare qui, ma dobbiamo confermare oggi il numero di persone.","Место согласилось на цену десять с человека. Можно остаться, но число участников нужно подтвердить сегодня.")],
 'entrance':[
  ("I'll wait by the other door and bring people to the main entrance.","Aspetto all'altra porta e accompagno le persone all'ingresso principale.","Я подожду у другой двери и провожу людей к главному входу."),
  ("The photo helps. Everyone can find the blue sign. We still need to answer any late messages.","La foto aiuta. Tutti possono trovare il cartello blu. Dobbiamo comunque rispondere agli ultimi messaggi.","По фото можно найти синюю табличку. Остаётся отвечать тем, кто напишет в последний момент."),
  ("Good. Nobody has to find the way alone. You will miss the first few minutes while you wait outside.","Bene. Nessuno deve trovare la strada da solo. Perderai i primi minuti mentre aspetti fuori.","Никому не придётся искать дорогу одному. Но, встречая людей, ты пропустишь начало.")],
 'noise':[
  ("Let's ask them to turn the music down. We can stay together here.","Chiediamo di abbassare la musica. Possiamo restare insieme qui.","Давай попросим убавить музыку и останемся здесь."),
  ("The quiet room is ready. We can hear clearly, but we need to tell late arrivals where we are.","La sala tranquilla è pronta. Sentiamo bene, ma dobbiamo dire a chi arriva dopo dove siamo.","В тихой комнате хорошо слышно. Нужно предупредить опаздывающих, куда вы переместились."),
  ("They have turned it down. It is easier to hear now. We can stay, but we should check again when more people arrive.","Hanno abbassato la musica. Ora si sente meglio. Possiamo restare, ma dobbiamo controllare quando arrivano altre persone.","Музыку убавили, слышно лучше. Вы остаётесь, но с приходом остальных нужно снова проверить слышимость.")],
 'participation':[
  ("Let's talk in pairs first. Everyone can prepare an idea with a partner.","Parliamo prima a coppie. Ognuno può preparare un'idea con un compagno.","Сначала обсудим в парах: каждый сможет подготовить мысль вместе с партнёром."),
  ("Good. People can write later. We must wait for their comments before making the final decision.","Bene. Le persone possono scrivere dopo. Dobbiamo aspettare i commenti prima della decisione finale.","Мнения можно прислать позже. Окончательное решение придётся отложить до их получения."),
  ("The pairs are ready. More people are speaking now. We have less time for the final group discussion.","Le coppie sono pronte. Ora parlano più persone. Abbiamo meno tempo per la discussione finale insieme.","В парах заговорило больше участников. На общее обсуждение осталось меньше времени.")],
 'tasks':[
  ("I'll make the booking. Can you contact the group instead?", "Prenoto io. Puoi invece contattare il gruppo?", "Я возьму бронирование. А ты свяжешься с участниками?"),
  ("Thank you. You contact the group and I make the booking. Please tell me how many people can come.","Grazie. Tu contatti il gruppo e io prenoto. Dimmi quante persone possono venire.","Ты связываешься с участниками, собеседник бронирует. Ему нужно передать число людей."),
  ("Thank you. You make the booking and I contact the group. I'll send you the number of people before you confirm.","Grazie. Tu prenoti e io contatto il gruppo. Ti mando il numero di persone prima della conferma.","Ты бронируешь, собеседник связывается с участниками. Подтверждение зависит от его ответа о числе людей.")],
 'date':[
  ("Let's check the official page together before we contact anyone.","Controlliamo insieme la pagina ufficiale prima di contattare qualcuno.","Прежде чем кому-либо звонить, давай вместе проверим официальную страницу."),
  ("The organiser confirms Saturday. They will correct the old message. We can now share the date.","Chi organizza conferma sabato. Correggerà il vecchio messaggio. Ora possiamo comunicare la data.","Организатор подтвердил субботу и исправит старое сообщение. Теперь дату можно сообщить группе."),
  ("The official page confirms Saturday. We have the link, but the old message still says Friday. We should point out the difference.","La pagina ufficiale conferma sabato. Abbiamo il link, ma il vecchio messaggio dice ancora venerdì. Dobbiamo spiegare la differenza.","На официальной странице подтверждена суббота. Ссылка есть, но старое сообщение ещё не исправлено: разницу нужно объяснить.")],
 'scope':[
  ("Let's try all five ideas briefly. We can choose one to explore next time.","Proviamo brevemente tutte e cinque le idee. Poi ne scegliamo una per la prossima volta.","Коротко попробуем все пять идей и выберем одну для следующей встречи."),
  ("We have chosen two ideas. There is time to explore them properly. The other three will have to wait.","Abbiamo scelto due idee. C'è tempo per approfondirle. Le altre tre devono aspettare.","Выбраны две идеи: их можно проработать глубже. Остальные три пока откладываются."),
  ("We can give each idea ten minutes. Everyone gets a turn, but we cannot go into detail today.","Possiamo dare dieci minuti a ogni idea. Tutti hanno un turno, ma oggi non possiamo approfondire.","Каждой идее выделяем десять минут. Все получат слово, но сегодня без подробной проработки.")]
}
FRAMES={
 'A1':[('','','')]*3,
 'A2':[("We didn't plan it this way, but we can change it.","Non era questo il programma, ma possiamo cambiarlo.","Такого в плане не было, но его можно изменить."),("We changed the plan, so we need to explain it.","Abbiamo cambiato il programma, quindi dobbiamo spiegarlo.","План изменился, поэтому его нужно объяснить."),("This was not our first plan, but now we have a clear next step.","Non era il primo programma, ma ora sappiamo come procedere.","Это не первоначальный план, зато следующий шаг теперь понятен.")],
 'B1':[("If we try this, we will need to explain why the plan has changed.","Se proviamo così, dovremo spiegare perché il programma è cambiato.","Если попробуем так, нужно будет объяснить изменение плана."),("I would check with the people who were not here when we discussed it.","Chiederei anche alle persone che non erano qui quando ne abbiamo parlato.","Я бы уточнил мнение тех, кто не присутствовал при обсуждении."),("It would be useful to check that everyone has understood the new arrangement.","Sarebbe utile verificare che tutti abbiano capito il nuovo accordo.","Стоит проверить, все ли поняли новую договорённость.")],
 'B2':[("Although this involves changing the arrangement, it may be easier to explain than to carry on with a plan that no longer works.","Benché questo comporti una modifica, potrebbe essere più facile spiegarla che continuare con un programma che non funziona più.","Хотя договорённость придётся изменить, объяснить это может быть проще, чем держаться за неработающий план."),("Had we discussed the constraints earlier, we might have avoided this compromise. Now we should make its consequences clear.","Se avessimo discusso prima i vincoli, avremmo forse evitato questo compromesso. Ora è meglio chiarirne le conseguenze.","Раннее обсуждение ограничений могло бы избавить от компромисса. Теперь нужно ясно назвать его последствия."),("I agree, provided that the people affected have a chance to respond before the decision becomes final.","Sono d'accordo, purché le persone coinvolte possano rispondere prima che la decisione diventi definitiva.","Я согласен при условии, что затронутые решением люди успеют высказаться до его окончательного принятия.")],
 'C1':[("Were we to adopt this alternative, its practical advantages would still have to be weighed against the expectations created by our original invitation.","Qualora adottassimo questa alternativa, i vantaggi pratici andrebbero comunque valutati rispetto alle aspettative suscitate dall'invito iniziale.","Выбрав альтернативу, всё же придётся соотнести её практические преимущества с ожиданиями от первоначального приглашения."),("The compromise remains defensible insofar as its consequences are made explicit; treating a lack of objections as informed agreement would undermine that justification.","Il compromesso resta giustificabile nella misura in cui se ne rendono esplicite le conseguenze; interpretare l'assenza di obiezioni come consenso informato ne indebolirebbe la giustificazione.","Компромисс обоснован, пока его последствия названы прямо; молчание нельзя принимать за осознанное согласие."),("Having reconsidered the original arrangement, we should document both the revised decision and the constraints that prompted it, so that subsequent participants can assess it on the same basis.","Riconsiderato l'accordo iniziale, dovremmo documentare sia la decisione rivista sia i vincoli che l'hanno determinata, affinché chi parteciperà in seguito possa valutarla sulle stesse basi.","Пересмотрев договорённость, стоит зафиксировать новое решение и вызвавшие его ограничения, чтобы последующие участники могли оценить их на тех же основаниях.")]
}
DELIVERY=[
 ("I'll send a message and ask everyone to reply.","Mando un messaggio e chiedo a tutti di rispondere.","Отправлю сообщение и попрошу каждого ответить."),
 ("Let's explain the plan together before we start.","Spieghiamo insieme il programma prima di iniziare.","Объясним план вместе перед началом."),
 ("The message is sent. Two people ask a question, and you answer. Everyone now knows the plan.","Il messaggio è partito. Due persone fanno una domanda e tu rispondi. Ora tutti conoscono il programma.","Сообщение отправлено. Двое задали вопросы, ты ответил. Теперь всем известен план."),
 ("The group is here. You explain the plan and answer the questions. The introduction takes a little longer, but everyone can take part.","Il gruppo è qui. Spieghi il programma e rispondi alle domande. L'introduzione dura un po' di più, ma tutti possono partecipare.","Группа собралась. Ты объяснил план и ответил на вопросы. Вступление заняло больше времени, зато все включились.")]

def main():
 audio=json.loads((ROOT/'content/audio-library/series-v1.json').read_text())
 legacy=[s for s in json.loads((ROOT/'content/catalog-v1.json').read_text())['stories'] if s['status']=='available']
 topics={t['id']:t for t in audio['topics']};segments={};stories=[]
 def segment(key,texts,lang,level,female=False,frame=None):
  n=0 if lang=='en' else 1;text=texts[n];ru=texts[2]
  if frame and frame[n]:text+=' '+frame[n];ru+=' '+frame[2]
  voice={'en':('bm_george','bf_emma'),'it':('im_nicola','if_sara')}[lang][int(female)]
  segments[key]=dict(language=lang,level=level,voice=voice,text=text,ru=ru,textSha256=hashlib.sha256(text.encode()).hexdigest())
  return key
 def clip(key):return {'set':'course','id':key}
 def oldclip(key):return {'set':'library','id':key}
 for lang in ['en','it']:
  position=0
  for level in LEVELS:
   old=sorted([s for s in legacy if s['language']==lang and s['practiceLevel']==level],key=lambda s:s['content']['number'])
   for s in old:
    e=s['content'];nodes={}
    for nid,node in e['nodes'].items():
     key=f"legacy-{e['id']}-{nid}"
     who=node['speaker'];female=who in ['Maya','Emma','Giulia']
     sid=segment(key,(node['text'],node['text'],node['ru']),lang,level,female)
     nodes[nid]={'clips':[clip(sid)],'choices':node['choices'],'outcome':e['outcomes'].get(node.get('outcome',''))}
    position+=1
    stories.append(dict(id=e['id'],legacy=True,language=lang,level=level,position=position,title=e['title'],topic=e['category'],summary=e['summary'],art=e['art'],context=e['contextText'],start='start',nodes=nodes,origin='Авторская интерактивная история'))
   # Rotate topics between neighbouring variants. Omit the last few source
   # variants per level to keep exactly 200 lessons INCLUDING legacy stories.
   candidates=[s for s in audio['stories'] if s['language']==lang and s['level']==level]
   variants=list(BRANCHES)
   candidates.sort(key=lambda s:(variants.index(s['variant']),list(topics).index(s['topic'])))
   for s in candidates[:200-len(old)]:
    variant=s['variant'];rows=BRANCHES[variant];prefix=f'{lang}-{level}-{variant}'
    extra=[segment(prefix+'-'+str(i),row,lang,level,i==0,FRAMES[level][i]) for i,row in enumerate(rows)]
    delivery=[segment(f'{lang}-{level}-delivery-{i}',row,lang,level,i<2,FRAMES[level][min(i,2)] if i>=2 else None) for i,row in enumerate(DELIVERY)]
    intro,problem,decision,_=s['segments'];a=audio['segments'][decision];b=segments[extra[0]]
    follow=[{'text':segments[delivery[0]]['text'],'label':DELIVERY[0][2],'next':'message'},{'text':segments[delivery[1]]['text'],'label':DELIVERY[1][2],'next':'together'}]
    nodes={'start':{'clips':[oldclip(intro),oldclip(problem)],'choices':[{'text':a['text'],'label':a['ru'],'next':'a'},{'text':b['text'],'label':rows[0][2],'next':'b'}]}}
    for branch,reply,consequence in [('a',oldclip(decision),extra[1]),('b',clip(extra[0]),extra[2])]:
     nodes[branch]={'clips':[reply,clip(consequence)],'choices':[{**c,'next':branch+'-'+c['next']} for c in follow]}
     for kind,i in [('message',0),('together',1)]:
      nodes[branch+'-'+kind]={'clips':[clip(delivery[i]),clip(delivery[i+2])],'choices':[],'outcome':{'title':'План согласован '+('в переписке' if i==0 else 'при встрече'),'body':rows[1 if branch=='a' else 2][2]+' '+DELIVERY[i+2][2]}}
    position+=1;t=topics[s['topic']]
    art='work' if s['topic'] in ['meeting','workshop','project','coworking','interview'] else 'train' if s['topic'] in ['walk','market','museum','trip'] else 'film' if s['topic'] in ['cinema','bookclub','photo','localnews'] else 'coffee'
    stories.append(dict(id='story-'+s['id'],legacy=False,language=lang,level=level,position=position,title=s['title'],topic=t['title'],summary=t['stakes']['ru'],art=art,context=f"Ваша цель — {t['goal']['ru']}. {t['stakes']['ru']} Выбери, как действовать, и посмотри, что изменится.",start='start',nodes=nodes,origin='Интерактивный вариант: общие ситуации и сцены переиспользуются для практики.'))
 assert Counter((s['language'],s['level']) for s in stories)==Counter({(l,v):200 for l in ['en','it'] for v in LEVELS})
 data={'formatVersion':1,'releaseId':'story-course-v1','levels':LEVELS,'provenance':'40 существующих сюжетов и 1960 интерактивных вариантов на основе 25 ситуаций и 8 затруднений. Варианты переиспользуют сцены; это не 2000 независимых авторских сюжетов.','segments':segments,'stories':stories}
 target=ROOT/'content/story-course/course-v1.json';encoded=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n'
 if target.exists() and target.read_text()!=encoded:raise ValueError('Use a new releaseId and path for a changed published course')
 target.write_text(encoded)
 print(len(stories),'interactive stories;',len(segments),'new recordings;',target.stat().st_size,'bytes')
if __name__=='__main__':main()
