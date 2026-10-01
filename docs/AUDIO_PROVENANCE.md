# Seed audio provenance

The shipped OGG files are Korean speech recordings from Wikimedia Commons. Each file is redistributed without editing. Attribution and license links are below.

| Local file | Source and attribution | License |
| --- | --- | --- |
| `public/audio/lessons/korean-vowels.ogg` | [Korean vowels.ogg](https://commons.wikimedia.org/wiki/File:Korean_vowels.ogg), Koreanchick80 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/exercises/vowel-a.ogg` | [Ko-아.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EC%95%84.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `public/audio/exercises/mul.ogg` | [Ko-물.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EB%AC%BC.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `public/audio/vocab/mul.ogg` | Same unmodified [Ko-물.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EB%AC%BC.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `public/audio/vocab/ai.ogg` | [Ko-아이.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EC%95%84%EC%9D%B4.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `public/audio/vocab/chaek.ogg` | [Ko-책.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EC%B1%85.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `public/audio/vocab/haksaeng.ogg` | [Ko-학생.ogg](https://commons.wikimedia.org/wiki/File:Ko-%ED%95%99%EC%83%9D.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `public/audio/vocab/jip.ogg` | [Ko-집.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EC%A7%91.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `public/audio/vocab/nun.ogg` | [Ko-눈.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EB%88%88.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `public/audio/vocab/seonsaengnim.ogg` | [Ko-선생님.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EC%84%A0%EC%83%9D%EB%8B%98.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `public/audio/vocab/son.ogg` | [Ko-손.ogg](https://commons.wikimedia.org/wiki/File:Ko-%EC%86%90.ogg), HappyMidnight | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |

The lesson clip is described by its creator as “Korean vowels”; its exact spoken sequence is not documented on the source page. Avoid assuming that the recording follows the lesson's printed sequence. Bundled word recordings are listed in `src/shared/audio/vocabulary-recordings.json`; learner cards and summary tables use these exact Hangul matches when no custom Audio URL is set, including existing database rows. Words without a verified recording show a disabled speaker button. The public attribution file is `/audio/vocab/ATTRIBUTION.txt`, linked from the vocabulary sections. The seed's repair step replaces only its own old placeholder URLs and leaves user supplied URLs intact.
