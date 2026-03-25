const fs = require('fs');

function convertKakaoToJSON(inputFileName, outputFileName) {
  try {
    const content = fs.readFileSync(inputFileName, 'utf-8');
    const lines = content.split(/\r?\n/);

    let messages = [];
    let currentMessage = null;
    let currentDate = "";

    // 1. 참여자 명단을 담을 Set (중복 제거용)
    const participants = new Set();

    // 2. 봇으로 판정할 이름들 (여기에 확인된 봇 이름을 추가하세요)
    const BOT_NAMES = ["채팅봇", "롤피에스", "다빈이"];

    const dateRegex = /^-+ (\d{4}년 \d{1,2}월 \d{1,2}일) .+-+$/;
    const headerRegex = /^\[(.+?)\] \[(오전|오후) (\d{1,2}:\d{2})\] (.*)/;

    lines.forEach(line => {
      const dateMatch = line.match(dateRegex);
      const headerMatch = line.match(headerRegex);

      if (dateMatch) {
        currentDate = dateMatch[1];
      } else if (headerMatch) {
        const [_, sender, ampm, time, contentText] = headerMatch;

        // 참여자 목록에 이름 추가
        participants.add(sender);

        const isEmoticon = contentText.trim() === "이모티콘";
        const isPhoto = contentText.trim() === "사진";
        const isVideo = contentText.trim() === "동영상";

        currentMessage = {
          date: currentDate,
          time: `${ampm} ${time}`,
          sender: sender,
          message: contentText,
          is_emoticon: isEmoticon,
          is_photo: isPhoto,
          is_video: isVideo,
          // 3. 봇 여부 확인 키 추가
          isBot: BOT_NAMES.includes(sender),
          isBroadcast: false
        };
        messages.push(currentMessage);
      } else if (currentMessage && line.trim() !== "" && !line.includes("저장한 날짜")) {
        currentMessage.message += "\n" + line;
      }
    });

    // 결과 저장
    fs.writeFileSync(outputFileName, JSON.stringify(messages, null, 2), 'utf-8');

    // 4. 터미널에 참여자 명단 출력 (봇 구분을 위해)
    console.log(`✅ 변환 완료!`);
    console.log(`\n👥 [대화 참여자 명단]`);
    console.log(Array.from(participants).map(p => `- ${p}`).join('\n'));
    console.log(`\n🤖 설정된 봇 목록: [${BOT_NAMES.join(', ')}]`);
    console.log(`📊 총 메시지 개수: ${messages.length}개`);

  } catch (error) {
    console.error("❌ 에러 발생:", error.message);
  }
}

convertKakaoToJSON('여기에 카카오톡 대화 내용 파일 넣으세요', 'result.json');