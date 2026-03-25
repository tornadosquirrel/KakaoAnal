const fs = require('fs');
const data = JSON.parse(fs.readFileSync('result.json', 'utf-8'));

const stats = {
  daily: {}, hourly: {}, sender: {}, fullMessages: {}, allWords: {},
  mentions: { whoMentioned: {}, whoWasMentioned: {} },
  rapidFire: { currentSender: null, currentCount: 0, startTime: "", startDate: "", maxCounts: {} }
};

data.forEach((msg) => {
  const { date, time, sender, message, is_emoticon, is_photo, is_video, isBot, isBroadcast } = msg;
  if (isBot || isBroadcast) return;

  // 기본 세팅
  if (!stats.sender[sender]) {
    stats.sender[sender] = {
      count: 0, photoVideo: 0, totalLength: 0, exclamation: 0, question: 0, dots: 0,
      k: 0, u: 0, sweat: 0, numbers: 0, lazy: 0, links: 0,
      personalMessages: {}, // 인물별 단일 메시지 저장소
      maxNoSpace: { length: 0, date: "", time: "" },
      maxMessage: { length: 0, date: "", time: "" }
    };
  }
  const s = stats.sender[sender];

  // 1 & 2. 날짜/시간별
  stats.daily[date] = (stats.daily[date] || 0) + 1;
  if (time) {
    const hourKey = `${time.split(' ')[0]} ${time.split(' ')[1].split(':')[0]}시`;
    stats.hourly[hourKey] = (stats.hourly[hourKey] || 0) + 1;
  }

  // 3. 송신자별 횟수
  s.count++;

  // 4. 미디어 빌런
  if (is_photo || is_video || is_emoticon) s.photoVideo++;

  // 5. 메시지 분석 (미디어 제외)
  if (!is_photo && !is_video && !is_emoticon && message && message.trim()) {
    const trimmedMsg = message.trim();

    // 전체 도배 순위
    stats.fullMessages[trimmedMsg] = (stats.fullMessages[trimmedMsg] || 0) + 1;

    // [추가] 인물별 가장 많이 한 단일 메시지
    s.personalMessages[trimmedMsg] = (s.personalMessages[trimmedMsg] || 0) + 1;

    // 단어 분석
    const words = trimmedMsg.split(/\s+/).filter(w => w.length > 0);
    words.forEach(word => {
      stats.allWords[word] = (stats.allWords[word] || 0) + 1;
      if (word.length > s.maxNoSpace.length) {
        s.maxNoSpace = { length: word.length, date: date, time: time };
      }
    });
  }

  // 6. 언급 분석
  const mentionMatches = message.match(/@(.+?)(?=\s|$)/g);
  if (mentionMatches) {
    mentionMatches.forEach(m => {
      const target = m.replace('@', '').trim();
      stats.mentions.whoMentioned[sender] = (stats.mentions.whoMentioned[sender] || 0) + 1;
      stats.mentions.whoWasMentioned[target] = (stats.mentions.whoWasMentioned[target] || 0) + 1;
    });
  }

  // 7. 메시지 호흡
  s.totalLength += message.length;
  if (message.length > s.maxMessage.length) {
    s.maxMessage = { length: message.length, date: date, time: time };
  }

  // 8~13. 기호/자음/숫자
  s.exclamation += (message.match(/!/g) || []).length;
  s.question += (message.match(/\?/g) || []).length;
  s.k += (message.match(/ㅋ/g) || []).length;
  s.u += (message.match(/ㅠ/g) || []).length;
  s.sweat += (message.match(/;/g) || []).length;
  s.numbers += (message.match(/\d/g) || []).length;

  // 14. 속사포
  if (stats.rapidFire.currentSender === sender) {
    stats.rapidFire.currentCount++;
  } else {
    if (stats.rapidFire.currentSender) {
      const prev = stats.rapidFire.currentSender;
      if (!stats.rapidFire.maxCounts[prev] || stats.rapidFire.currentCount > stats.rapidFire.maxCounts[prev].count) {
        stats.rapidFire.maxCounts[prev] = { count: stats.rapidFire.currentCount, date: stats.rapidFire.startDate, time: stats.rapidFire.startTime };
      }
    }
    stats.rapidFire.currentSender = sender; stats.rapidFire.currentCount = 1;
    stats.rapidFire.startDate = date; stats.rapidFire.startTime = time;
  }

  // 16. 귀차니즘
  const lazyMatch = message.match(/([ㄱ-ㅎ])\1+/g);
  if (lazyMatch) lazyMatch.forEach(m => { if (!m.includes('ㅋ')) s.lazy++; });

  // 17. 링크
  if (message.includes('http')) s.links++;
});

// --- 리포트 출력 함수 ---
function printRank(title, dataObj, suffix = "", limit = 5, reverse = false) {
  console.log(`\n──────────────────────────────────────────────────────────`);
  console.log(`  📊 ${title}`);
  console.log(`──────────────────────────────────────────────────────────`);
  const entries = Object.entries(dataObj).filter(([k]) => k !== "SYSTEM" && k !== "undefined");
  const getVal = (v) => (typeof v === 'object' ? (v.count || v.length || 0) : v);
  const sorted = entries.sort((a, b) => getVal(b[1]) - getVal(a[1]));

  console.log(` [TOP ${limit}]`);
  sorted.slice(0, limit).forEach(([key, val], i) => {
    const v = getVal(val);
    console.log(`  ${i + 1}위 | ${key.padEnd(10)} : ${v}${suffix}`);
    if (typeof val === 'object' && val.date) console.log(`       └ [정보] ${val.date} ${val.time} 기록`);
  });

  if (reverse) {
    console.log(` [BOTTOM ${limit}]`);
    sorted.slice(-limit).reverse().forEach(([key, val], i) => {
      console.log(`  뒤에서 ${i + 1}위 | ${key.padEnd(10)} : ${getVal(val)}${suffix}`);
    });
  }
}

// [추가] 인물별 가장 많이 한 메시지 출력 함수
function printPersonalTopMessage() {
  console.log(`\n──────────────────────────────────────────────────────────`);
  console.log(`  📊 인물별 가장 많이 한 단일 메시지 (Top 5)`);
  console.log(`──────────────────────────────────────────────────────────`);

  Object.entries(stats.sender).forEach(([name, s]) => {
    // 1. 메시지 빈도순으로 정렬
    const sortedMsgs = Object.entries(s.personalMessages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // 상위 5개만 추출

    console.log(` [ ${name} ]`);
    if (sortedMsgs.length === 0) {
      console.log(`   데이터가 없습니다.`);
    } else {
      sortedMsgs.forEach(([msg, count], i) => {
        console.log(`  ${i + 1}위 | "${msg}" (${count}회)`);
      });
    }
    console.log(``); // 인물 간 구분을 위한 빈 줄
  });
}

// --- 실행 ---
console.log(`\n          🔥 야무진 카톡 17개 항목 분석 리포트 🔥          `);
printRank("1. 날짜별 화력", stats.daily, "개", 10, true);
printRank("2. 시간대별 화력", stats.hourly, "개", 12, true);
printRank("3. 송신자별 전송 횟수", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.count])), "회");
printRank("4. 미디어 빌런", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.photoVideo])), "개");
printRank("5-1. 동일 메시지 반복 (전체)", stats.fullMessages, "회", 10);
printPersonalTopMessage(); // [신규 항목]
printRank("5-2. 가장 많이 쓰인 단어", stats.allWords, "회", 10);
printRank("6-1. 인싸 분석 (가장 많이 언급됨)", stats.mentions.whoWasMentioned, "회", 6);
printRank("6-2. 마당발 분석 (가장 많이 언급함)", stats.mentions.whoMentioned, "회");
printRank("7-1. 메시지 호흡 (평균 글자수)", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, Math.round(v.totalLength / v.count)])), "자");
printRank("7-2. 메시지 호흡 (가장 긴 메시지)", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.maxMessage])), "자", 10);
printRank("8. 느낌표 빌런", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.exclamation])), "개");
printRank("9. 물음표 빌런", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.question])), "개");
printRank("10. 해피바이러스 (ㅋ)", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.k])), "개");
printRank("11. 디프레션 (ㅠ)", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.u])), "개");
printRank("12. 땀띠 분석 (;)", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.sweat])), "개");
printRank("13. 숫자 중독", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.numbers])), "개");
printRank("14. 속사포 분석", stats.rapidFire.maxCounts, "연발", 10);
printRank("15. 띄어쓰기 불능 (가장 긴 어절)", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.maxNoSpace])), "자", 10);
printRank("16. 귀차니즘 (초성)", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.lazy])), "회");
printRank("17. 링크 애호가", Object.fromEntries(Object.entries(stats.sender).map(([k, v]) => [k, v.links])), "회");